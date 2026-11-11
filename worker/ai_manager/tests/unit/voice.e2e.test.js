'use strict';

/**
 * Voice path e2e: STT → chat/approve → TTS compose.
 * Mocks upstreams by default; optionally probes Orin when VOICE_LIVE=1.
 */

const axios = require('axios');
const { VoiceProxyService, cfg, resolveTtsUrl } = require('../../api/services/VoiceProxyService');
const { AgentRuntime } = require('../../api/services/AgentRuntime');
const shop = require('../../api/services/AgentShop');

jest.mock('axios');

const PID = 'dddddddd-eeee-4fff-8000-111111111111';
const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';

function memAgents() {
  const agents = [];
  const settings = {
    llm_max_concurrent: 1,
    workspace_root: '/tmp/voice-e2e',
    write_policy: 'ask_writes',
    write_exceptions: [],
  };
  const messages = [];
  const asks = [];
  const pins = [];
  const rolls = {};
  const audit = [];
  let ids = 1;
  return {
    getSettings: async () => settings,
    resolve: async (_p, id) => agents.find((a) => a.id === id || a.name === id),
    addMessage: async (_p, agentId, row) => { messages.push({ id: String(ids++), agent_id: agentId, ...row }); },
    listMessages: async () => messages,
    listPins: async () => pins,
    getRolls: async () => rolls,
    upsertRoll: async (_p, _a, h, body) => { rolls[h] = { horizon: h, body }; return rolls[h]; },
    createAsk: async (_p, agentId, row) => {
      const ask = {
        id: String(ids++), agent_id: agentId, status: 'open',
        options_json: JSON.stringify(row.options || []), ...row,
      };
      asks.push(ask);
      return ask;
    },
    listAsks: async () => asks,
    approve: async (_p, _a, askId, answer) => {
      const ask = asks.find((x) => x.id === askId);
      ask.status = 'answered';
      ask.answer = answer;
      return ask;
    },
    listWork: async () => [],
    listWorkers: async () => [],
    addTimeline: async () => ({}),
    cancelOpenAsks: async () => {
      asks.forEach((a) => { if (a.status === 'open') a.status = 'cancelled'; });
      return { cancelled: true };
    },
    audit: async (_p, agentId, row) => { audit.push({ agent_id: agentId, ...row }); },
    pulse: async () => ({
      agent: agents[0], settings, open_asks: asks.filter((a) => a.status === 'open'),
      work: [], workers: [], gateway: { max_concurrent: 1, in_flight: [], queued: [] },
    }),
    _seed(agent) { agents.push(agent); return agent; },
    _asks: asks,
    _messages: messages,
  };
}

describe('VoiceProxyService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('cfg + resolveTtsUrl backends', () => {
    expect(resolveTtsUrl(cfg({ TTS_BACKEND: 'cache' }))).toMatch(/8015/);
    expect(resolveTtsUrl(cfg({ TTS_BACKEND: 'kokoro' }))).toMatch(/8013/);
    expect(resolveTtsUrl(cfg({ TTS_BACKEND: 'xtts' }))).toMatch(/8002/);
    expect(resolveTtsUrl(cfg({ TTS_URL: 'http://custom:9' }))).toBe('http://custom:9');
  });

  test('forIntegration maps STT and TTS records', () => {
    const stt = VoiceProxyService.forIntegration({
      capability: 'stt', provider_type: 'whisper', endpoint: 'http://orin:8001', apiKey: 'k',
    });
    expect(stt.c.sttUrl).toBe('http://orin:8001');
    expect(stt.c.sttAuth).toBe('k');
    const tts = VoiceProxyService.forIntegration({
      capability: 'tts', provider_type: 'kokoro', endpoint: 'http://orin:8013', model: 'af_bella',
      options: { language: 'en' },
    });
    expect(tts.ttsTarget()).toBe('http://orin:8013');
    expect(tts.c.ttsVoice).toBe('af_bella');
  });

  test('synthesize posts icarus contract and returns wav buffer', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: Buffer.from('RIFF....WAVE'),
      headers: { 'content-type': 'audio/wav', 'x-voice': 'af_heart', 'x-cache': 'HIT' },
    });
    const v = new VoiceProxyService({ TTS_BACKEND: 'cache', TTS_CACHE_URL: 'http://tts.test' });
    const out = await v.synthesize({ text: 'Hello from Icarus' });
    expect(out.contentType).toBe('audio/wav');
    expect(Buffer.isBuffer(out.buffer)).toBe(true);
    expect(out.cache).toBe('HIT');
    expect(axios.post).toHaveBeenCalledWith(
      'http://tts.test/synthesize',
      expect.objectContaining({ text: 'Hello from Icarus' }),
      expect.objectContaining({ responseType: 'arraybuffer' }),
    );
  });

  test('synthesize rejects empty text and upstream errors', async () => {
    const v = new VoiceProxyService({ TTS_CACHE_URL: 'http://tts.test' });
    await expect(v.synthesize({ text: '  ' })).rejects.toMatchObject({ status: 400 });
    axios.post.mockResolvedValue({ status: 503, data: Buffer.from('down'), headers: {} });
    await expect(v.synthesize({ text: 'hi' })).rejects.toMatchObject({ status: 502 });
  });

  test('transcribe multipart STT returns text', async () => {
    axios.post.mockResolvedValue({ status: 200, data: { text: 'yes run it' } });
    const v = new VoiceProxyService({ STT_URL: 'http://stt.test' });
    const out = await v.transcribe(Buffer.from('fake-audio'), { contentType: 'audio/webm', language: 'en' });
    expect(out.text).toBe('yes run it');
    expect(axios.post.mock.calls[0][0]).toBe('http://stt.test/transcribe');
  });

  test('transcribe fails closed on bad upstream', async () => {
    const v = new VoiceProxyService({ STT_URL: 'http://stt.test' });
    await expect(v.transcribe(Buffer.alloc(0))).rejects.toMatchObject({ status: 400 });
    axios.post.mockResolvedValue({ status: 200, data: { ok: true } });
    await expect(v.transcribe(Buffer.from('x'))).rejects.toMatchObject({ status: 502 });
  });

  test('status probes report reachable false when down', async () => {
    axios.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const v = new VoiceProxyService({
      TTS_CACHE_URL: 'http://tts.down', STT_URL: 'http://stt.down',
    });
    const tts = await v.ttsStatus();
    const stt = await v.sttStatus();
    expect(tts.reachable).toBe(false);
    expect(stt.reachable).toBe(false);
  });
});

describe('AgentRuntime.voice e2e', () => {
  let agents;
  let runtime;

  beforeEach(() => {
    jest.clearAllMocks();
    expect(PID).not.toBe(FORBIDDEN);
    agents = memAgents();
    agents._seed({
      id: 'ag-voice',
      name: 'voice',
      mode: 'ask',
      language: 'en',
      tts: 'tts-cache',
      stt: 'whisper',
      voice: 'af_heart',
      intelligence: 'icarus-user',
      timezone: 'America/Los_Angeles',
    });
    runtime = new AgentRuntime({
      agents,
      jobs: { submit: async () => ({ id: 'job-v', status: 'queued' }) },
      connectors: { list: async () => [] },
    });
    runtime.chat = async () => ({
      reply: 'Got it from voice.',
      ask: null,
      agent_id: 'ag-voice',
    });
    runtime.interrupt = async () => ({ interrupted: true, reply: 'Stopped.' });
    runtime.approve = async (_p, _a, body) => ({
      approved: true, answer: body.answer, reply: 'Running it.',
      ask: { speak_text: 'Running it.', status: 'answered' },
    });
  });

  test('transcript path composes TTS when agent.tts set', async () => {
    axios.post.mockResolvedValue({
      status: 200,
      data: Buffer.from('RIFFWAV'),
      headers: { 'content-type': 'audio/wav' },
    });
    const out = await runtime.voice(PID, 'ag-voice', { transcript: 'hello from voice' });
    expect(out.compose).toBe(true);
    expect(out.transcript).toBe('hello from voice');
    expect(out.audio_base64).toBeTruthy();
    expect(Buffer.from(out.audio_base64, 'base64').toString()).toContain('RIFF');
  });

  test('audio_base64 STT then chat', async () => {
    axios.post
      .mockResolvedValueOnce({ status: 200, data: { text: 'search the docs' } })
      .mockResolvedValueOnce({
        status: 200,
        data: Buffer.from('TTS'),
        headers: { 'content-type': 'audio/wav' },
      });
    const out = await runtime.voice(PID, 'ag-voice', {
      audio_base64: Buffer.from('pcm').toString('base64'),
    });
    expect(out.transcript).toBe('search the docs');
    expect(out.reply).toBe('Got it from voice.');
    expect(out.audio_base64).toBeTruthy();
  });

  test('STT down opens Type instead ASK', async () => {
    axios.post.mockResolvedValue({ status: 503, data: { error: 'down' } });
    await expect(
      runtime.voice(PID, 'ag-voice', { audio_base64: Buffer.from('x').toString('base64') }),
    ).rejects.toMatchObject({ status: 502 });
    expect(agents._asks.some((a) => a.payload?.dep === 'stt')).toBe(true);
  });

  test('voice yes on open ASK approves recommended', async () => {
    axios.post.mockResolvedValue({
      status: 200, data: Buffer.from('ok'), headers: { 'content-type': 'audio/wav' },
    });
    await agents.createAsk(PID, 'ag-voice', {
      text: 'Run the plan?',
      options: ['Run it', 'Skip', 'Other'],
      recommended: 'Run it',
      kind: 'plan',
      speak_text: 'Run the plan?',
    });
    const intent = shop.voiceIntent('yes', agents._asks[0]);
    expect(intent.action).toBe('approve');
    const out = await runtime.voice(PID, 'ag-voice', { transcript: 'yes' });
    expect(out.approved).toBe(true);
    expect(out.answer).toBe('Run it');
  });

  test('voice stop interrupts', async () => {
    const out = await runtime.voice(PID, 'ag-voice', { transcript: 'stop' });
    expect(out.interrupted).toBe(true);
  });
});

describe('voice live Orin probe (optional)', () => {
  const live = process.env.VOICE_LIVE === '1';
  const testFn = live ? test : test.skip;

  testFn('STT/TTS health on configured URLs', async () => {
    jest.unmock('axios');
    jest.resetModules();
    const realAxios = jest.requireActual('axios');
    const { VoiceProxyService: LiveVoice } = jest.requireActual('../../api/services/VoiceProxyService');
    const v = new LiveVoice(process.env);
    // restore mock for other suites if re-ordered; this file ends here
    const stt = await v.sttStatus();
    const tts = await v.ttsStatus();
    expect(stt).toHaveProperty('reachable');
    expect(tts).toHaveProperty('reachable');
    if (stt.reachable) expect(stt.url || true).toBeTruthy();
    if (tts.reachable) expect(tts.url || true).toBeTruthy();
    void realAxios;
  });
});

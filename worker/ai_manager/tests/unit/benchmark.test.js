const {
  chatModelFilter,
  parseParamB,
  extractJson,
  scoreResponse,
} = require('../../api/services/LlmBenchmarkScoring');

describe('LlmBenchmarkService scoring', () => {
  test('chatModelFilter excludes embed and medgemma', () => {
    expect(chatModelFilter('llama3.2:3b')).toBe(true);
    expect(chatModelFilter('nomic-embed-text')).toBe(false);
    expect(chatModelFilter('medgemma:4b')).toBe(false);
    expect(chatModelFilter('translategemma:4b')).toBe(false);
  });

  test('parseParamB handles M and B', () => {
    expect(parseParamB('268.10M')).toBeCloseTo(0.2681, 3);
    expect(parseParamB('3.2B')).toBe(3.2);
  });

  test('extractJson parses fenced JSON', () => {
    const raw = '```json\n{"reply":"hi","commands":[]}\n```';
    expect(extractJson(raw)).toEqual({ reply: 'hi', commands: [] });
  });

  test('scoreResponse passes valid propose_create_task', () => {
    const content = JSON.stringify({
      reply: 'Done',
      expression: 'happy',
      commands: [{ kind: 'propose_create_task', payload: { title: 'Eat cake' } }],
    });
    const s = scoreResponse(content);
    expect(s.pass).toBe(true);
    expect(s.reason).toBe('ok');
  });

  test('scoreResponse fails refusal', () => {
    const s = scoreResponse('As an AI I cannot help with that');
    expect(s.pass).toBe(false);
    expect(s.reason).toBe('refusal');
  });

  test('scoreResponse fails missing commands', () => {
    const s = scoreResponse('{"reply":"ok","expression":"happy","commands":[]}');
    expect(s.pass).toBe(false);
    expect(s.reason).toBe('no_commands');
  });
});

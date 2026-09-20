'use strict';

const { AgentSetupService } = require('../../api/services/AgentSetupService');
const { friendSystem, formatAsk } = require('../../api/services/agentPrompt');
const shop = require('../../api/services/AgentShop');
const { listKinds, getKind } = require('../../api/services/connectorCatalog');
const { scrubSecrets } = require('../../api/services/agentArn');
const { classifyTool, dangerClassify } = require('../../api/services/workspaceTools');
const { getPreset } = require('../../../shared/gatewayPresets');

const FORBIDDEN = 'ea370977-3aff-4c76-95a6-a0c50fd2bce7';
const pid = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('agent logic (no sqlite)', () => {
  test('never targets the production project', () => {
    expect(pid).not.toBe(FORBIDDEN);
  });

  test('gateway presets for agent and connector', () => {
    expect(getPreset('ai-agent-chat')?.required_scope).toBe('ai:InvokeAgent');
    expect(getPreset('ai-connector-invoke')?.required_scope).toBe('ai:InvokeConnector');
  });

  test('connector kinds include mail calendar http mcp', () => {
    const names = listKinds().map((k) => k.name);
    expect(names).toEqual(expect.arrayContaining(['gmail', 'google-calendar', 'generic-http', 'generic-mcp', 'imap']));
    expect(getKind('gmail').tools.find((t) => t.name === 'count_today')).toBeTruthy();
  });

  test('shop routes by mode not work regex', () => {
    expect(shop.routeChat('ask').shop).toBe(false);
    expect(shop.routeChat('plan').shop).toBe(true);
    expect(shop.routeChat('agent').shop).toBe(true);
    expect(shop.inferPreview('create folder demo').type).toBe('folder');
  });

  test('friend system and ASK format', () => {
    const sys = friendSystem(
      { display_name: 'Icarus', timezone: 'America/Los_Angeles', mode: 'ask', name: 'icarus' },
      [{ key: 'tz', value: 'PT' }],
      { today: { body: 'inbox quiet' } },
    );
    expect(sys).toMatch(/Icarus/);
    expect(sys).toMatch(/PT/);
    expect(sys).toMatch(/inbox quiet/);
    const card = formatAsk({ text: 'Allow write?', options_json: '["Go ahead","Skip"]', recommended: 'Go ahead' });
    expect(card).toMatch(/<<ASK>>/);
    expect(card).toMatch(/Go ahead \(Recommended\)/);
  });

  test('secret scrub', () => {
    expect(scrubSecrets('Bearer abc.def token=xyz')).toMatch(/\[redacted\]/);
    expect(scrubSecrets('sk-abcdefghijklmnopqrstuvwxyz')).toMatch(/\[redacted\]/);
  });

  test('danger gate', () => {
    expect(dangerClassify('shell', { cmd: 'rm -rf /' }).level).toBe('deny');
    expect(dangerClassify('git_push', { branch: 'main' }).level).toBe('ask');
    expect(classifyTool('file_read')).toBe('read');
    expect(classifyTool('file_write')).toBe('write');
    expect(dangerClassify('browser_navigate', { url: 'https://pay.example/checkout' }).level).toBe('ask');
  });

  test('setup is idempotent with mocked deps', async () => {
    const store = { settings: null, agents: [] };
    const agents = {
      getSettings: async () => store.settings || {
        workspace_root: '/home/aerekos/work', write_policy: 'ask_writes', llm_max_concurrent: 1,
      },
      updateSettings: async (_p, body) => {
        store.settings = { workspace_root: body.workspace_root, write_policy: body.write_policy, llm_max_concurrent: body.llm_max_concurrent };
        return store.settings;
      },
      list: async () => store.agents,
      getByName: async () => {
        if (!store.agents[0]) { const e = new Error('missing'); e.status = 404; throw e; }
        return store.agents[0];
      },
      update: async (id, _p, body) => {
        store.agents[0] = { ...store.agents[0], ...body };
        return store.agents[0];
      },
      create: async (body) => {
        const row = { id: 'ag-1', ...body, type: 'icarus', arn: `arn:aerekos:${pid}:ai:agent:endpoint/${body.name}` };
        store.agents.push(row);
        return row;
      },
    };
    const setup = new AgentSetupService({
      agents,
      memory: { list: async () => [{ name: 'icarus-memory' }], upsertConfig: async () => ({}) },
      intel: { list: async () => [{ name: 'brain', execution: 'queued' }], update: async () => {}, create: async () => ({ name: 'brain' }) },
      rag: { create: async () => ({}) },
    });
    const a = await setup.apply(pid, { name: 'icarus', timezone: 'America/Los_Angeles' });
    const b = await setup.apply(pid, { name: 'icarus' });
    expect(a.agent.id).toBe(b.agent.id);
    expect(a.agent.type).toBe('icarus');
    expect(a.status.topology.computer).toBe('prod-mini');
    expect(a.status.topology.ai).toBe('orin');
    expect(a.status.ready).toBe(true);
  });
});

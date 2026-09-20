'use strict';

const fs = require('fs');
const { fail } = require('./agentArn');
const { resolveInWorkspace } = require('./workspaceTools');

class AgentSetupService {
  constructor(deps = {}) {
    this.agents = deps.agents || new (require('./AgentService').AgentService)();
    this.memory = deps.memory || new (require('./MemoryStoreService').MemoryStoreService)();
    this.intel = deps.intel || new (require('./IntelligenceService').IntelligenceService)();
    this.rag = deps.rag || new (require('./RagCollectionService').RagCollectionService)();
  }

  async status(projectId) {
    if (!projectId) throw fail(400, 'project_id required');
    const settings = await this.agents.getSettings(projectId);
    let intelligence = [];
    try { intelligence = await this.intel.list(projectId); } catch { /* */ }
    let memories = [];
    try { memories = await this.memory.list(projectId); } catch { /* */ }
    const agents = await this.agents.list(projectId);
    const queued = intelligence.filter((i) => (i.execution || 'sync') === 'queued');
    const probes = await this._probes(settings);
    const checks = {
      intelligence_queued: queued.length > 0,
      memory: memories.length > 0,
      workspace_root: !!settings.workspace_root,
      workspace_worker: !!settings.workspace_worker_id,
      write_policy: settings.write_policy === 'ask_writes',
      agent: agents.length > 0,
      computer: !!probes.computer_running,
      git: !!probes.git_present,
    };
    return {
      ready: checks.intelligence_queued && checks.memory && checks.workspace_root,
      checks,
      settings,
      intelligence: queued.map((i) => i.name),
      memories: memories.map((m) => m.name),
      agents: agents.map((a) => ({ id: a.id, name: a.name, arn: a.arn })),
      topology: {
        ai: 'orin',
        computer: 'prod-mini',
        workspace_root: settings.workspace_root,
      },
      probes,
    };
  }

  async _probes(settings) {
    const out = {
      workspace_ls: false,
      workspace_root: settings.workspace_root,
      computer_running: false,
      git_present: false,
    };
    try {
      const p = resolveInWorkspace(settings.workspace_root || '/home/aerekos/work', '.');
      out.workspace_ls = fs.existsSync(p);
    } catch (e) {
      out.workspace_error = e.message;
    }
    if (!settings.workspace_worker_id) return out;
    try {
      const { EngineService } = require('./EngineService');
      const engines = new EngineService();
      const found = await engines.inspectOnWorker(settings.workspace_worker_id, 'aerekos-icarus-workspace');
      const running = engines.runningOf(found);
      if (!running && found) {
        const healed = await engines.healNamed(settings.workspace_worker_id, 'aerekos-icarus-workspace', found);
        out.healed = healed;
      }
      const again = await engines.inspectOnWorker(settings.workspace_worker_id, 'aerekos-icarus-workspace');
      out.computer_running = engines.runningOf(again);
      if (out.computer_running) {
        const { proxy } = require('../../../shared/conductorProxy');
        const res = await proxy('POST', `/api/workers/${encodeURIComponent(settings.workspace_worker_id)}/containers/aerekos-icarus-workspace/exec`, {
          timeout: 15000,
          data: { cmd: ['sh', '-lc', 'git --version && ls'] },
        });
        const blob = JSON.stringify(res.data || '');
        out.git_present = /git version/i.test(blob);
        out.workspace_ls = out.workspace_ls || /./.test(blob);
        out.remote_exec = (res.status || 200) < 400;
      }
    } catch (e) {
      out.computer_error = e.message;
    }
    return out;
  }

  async apply(projectId, body = {}) {
    if (!projectId) throw fail(400, 'project_id required');
    const name = String(body.name || 'icarus').trim();
    let computerId = body.workspace_worker_id || '';
    if (!computerId) {
      try {
        const { proxy } = require('../../../shared/conductorProxy');
        const res = await proxy('GET', '/api/workers', { timeout: 4000 });
        const rows = res.data?.workers || res.data?.hosts || [];
        const hit = (rows || []).find((w) => /prod-mini|prod\.aerekos/i.test(`${w.hostname || ''} ${w.display_name || ''} ${w.id || ''}`));
        if (hit) computerId = hit.id;
      } catch { /* fleet unavailable in unit tests */ }
    }
    const settings = await this.agents.updateSettings(projectId, {
      workspace_root: body.workspace_root || '/home/aerekos/work',
      workspace_worker_id: computerId,
      llm_max_concurrent: body.llm_max_concurrent ?? 1,
      write_policy: body.write_policy || 'ask_writes',
      lane_min_interval_ms: body.lane_min_interval_ms ?? 0,
    });

    let intelligenceName = body.intelligence || '';
    try {
      const listed = await this.intel.list(projectId);
      const queued = listed.find((i) => (i.execution || '') === 'queued');
      if (!intelligenceName && queued) intelligenceName = queued.name;
      if (!intelligenceName && listed[0]) {
        await this.intel.update(listed[0].id, projectId, { execution: 'queued' });
        intelligenceName = listed[0].name;
      }
    } catch { /* no intel yet */ }
    if (!intelligenceName && body.create_intelligence !== false) {
      try {
        const created = await this.intel.create({
          project_id: projectId,
          name: `${name}-brain`,
          execution: 'queued',
          llm_integration: body.llm_integration || '',
          inject_memory: true,
          inject_rag: true,
          ingest_on_chat: true,
        });
        intelligenceName = created.name;
      } catch (e) {
        if (e.status !== 409) {
          /* leave empty — status will show */
        }
      }
    }

    try {
      const { LocalIntegrationSeed } = require('./LocalIntegrationSeed');
      await new LocalIntegrationSeed().seed(projectId);
    } catch { /* seed is idempotent; env may lack providers in tests */ }
    if (intelligenceName) {
      try {
        const { AiProviderService } = require('./AiProviderService');
        const listed = await new AiProviderService().list(projectId, 'llm');
        const llm = (listed || []).find((p) => p.is_default === 'true' && p.enabled !== 'false')
          || (listed || []).find((p) => p.enabled !== 'false')
          || listed?.[0];
        const ep = await this.intel.getByName(projectId, intelligenceName);
        if (llm && ep && !ep.llm_integration) {
          await this.intel.update(ep.id, projectId, { llm_integration: llm.name });
        }
      } catch { /* chat still works after a later bind */ }
    }

    const { friendStoreName, skillsCollectionName, codeAliasName } = require('./layerContext');
    const friendName = body.memory || friendStoreName(name);
    const legacyMemory = `${name}-memory`;
    try {
      await this.memory.upsertConfig(projectId, { name: friendName });
      if (legacyMemory !== friendName) await this.memory.upsertConfig(projectId, { name: legacyMemory });
    } catch { /* */ }
    try {
      if (settings.workspace_worker_id && this.memory.provision) {
        const cfg = await this.memory.getConfig?.(projectId, friendName);
        if (cfg && !cfg.data_worker_id && this.memory.upsertConfig) {
          await this.memory.upsertConfig(projectId, { name: friendName, data_worker_id: settings.workspace_worker_id });
        }
        await this.memory.provision(projectId, friendName);
      }
    } catch { /* data plane optional in tests */ }

    const skillsName = body.rag_collection || skillsCollectionName(name);
    const codeName = codeAliasName(name);
    try {
      await this.rag.create({ project_id: projectId, name: skillsName });
    } catch { /* duplicate ok */ }
    if (codeName !== skillsName) {
      try { await this.rag.create({ project_id: projectId, name: codeName }); } catch { /* */ }
    }

    if (intelligenceName) {
      try {
        const ep = await this.intel.getByName(projectId, intelligenceName);
        if (ep?.id) {
          try { await this.intel.attach(ep.id, projectId, { kind: 'memory', target_name: friendName }); } catch { /* */ }
          try { await this.intel.attach(ep.id, projectId, { kind: 'rag', target_name: skillsName }); } catch { /* */ }
          try { await this.intel.update(ep.id, projectId, { inject_memory: true, inject_rag: true, ingest_on_chat: true }); } catch { /* */ }
        }
      } catch { /* attach is best-effort */ }
    }

    const memoryName = friendName;
    const ragName = skillsName;

    if (settings.workspace_worker_id && body.place_workspace !== false) {
      try {
        const { EngineService } = require('./EngineService');
        const engines = new EngineService();
        await engines.place({
          kind: 'icarus_workspace',
          worker_id: settings.workspace_worker_id,
          start: true,
        });
      } catch { /* alpine workspace; never auto-start vLLM/XTTS/Ollama */ }
    }
    if (settings.workspace_worker_id && body.place_browser !== false) {
      try {
        const { EngineService } = require('./EngineService');
        const { resolveEndpoint } = require('./engineCatalog');
        const engines = new EngineService();
        const placed = await engines.place({
          kind: 'icarus_browser',
          worker_id: settings.workspace_worker_id,
          start: true,
        });
        const url = placed?.endpoint || resolveEndpoint('icarus_browser', { id: settings.workspace_worker_id }, '');
        if (url) {
          await this.agents.updateSettings(projectId, { browser_url: url });
          settings.browser_url = url;
        }
      } catch { /* Playwright sidecar; never auto-start vLLM/XTTS/Ollama */ }
    }

    let agent;
    try {
      agent = await this.agents.getByName(projectId, name);
      agent = await this.agents.update(agent.id, projectId, {
        intelligence: intelligenceName || agent.intelligence,
        memory: memoryName,
        rag_collection: ragName,
        timezone: body.timezone || agent.timezone,
        mode: body.mode || agent.mode,
        stt: body.stt != null ? body.stt : (agent.stt || 'orin-stt'),
        tts: body.tts != null ? body.tts : (agent.tts || 'orin-tts-cache'),
        user_id: body.user_id || agent.user_id,
      });
    } catch {
      agent = await this.agents.create({
        project_id: projectId,
        name,
        type: 'icarus',
        mode: body.mode || 'ask',
        intelligence: intelligenceName,
        memory: memoryName,
        rag_collection: ragName,
        timezone: body.timezone || 'America/Los_Angeles',
        stt: body.stt || 'orin-stt',
        tts: body.tts || 'orin-tts-cache',
        user_id: body.user_id || '',
      });
    }

    const status = await this.status(projectId);
    try {
      const { AgentCronTicker } = require('./AgentCronTicker');
      const idle = AgentCronTicker.defaultIdleCron(projectId, name);
      if (idle && this.agents.createCron) {
        const existing = await this.agents.listCron(projectId, agent.id);
        if (!(existing || []).some((c) => c.name === idle.name)) {
          await this.agents.createCron(projectId, agent.id, idle);
        }
      }
    } catch { /* */ }
    return { agent, settings, status };
  }
}

module.exports = { AgentSetupService };

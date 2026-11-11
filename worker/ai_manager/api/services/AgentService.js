'use strict';

const {
  Agent, AgentSettings, AgentWorkItem, AgentAsk, AgentWorker,
  AgentMessage, AgentPin, AgentRoll, AgentCron, AgentSkill, AgentAudit,
  AgentBrief, AgentTimeline,
} = require('../models');
const { emitAgentAsk, emitAgentAskAnswered } = require('../utils/aiLive');
const { isValidName } = require('../../../shared/arn');
const { enrichEndpoint } = require('./EndpointArn');
const { safeArn, json, fail, flag } = require('./agentArn');
const { gatewayFor } = require('./AgentGateway');

const DEFAULT_SETTINGS = {
  llm_max_concurrent: '1',
  lane_min_interval_ms: '0',
  workspace_worker_id: '',
  workspace_root: '/home/aerekos/work',
  write_policy: 'ask_writes',
  write_exceptions: '[]',
  notify_on_ask: 'send',
  notify_on_done: 'send',
  browser_url: '',
};

function serializeAgent(row) {
  if (!row) return row;
  const base = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  return enrichEndpoint({
    ...base,
    capability: 'agent',
    options: json(base.options, {}),
    enabled: base.enabled !== 'false',
    roll_refresh_sec: Number(base.roll_refresh_sec || 900),
  });
}

function serializeSettings(row, projectId) {
  const s = row ? (typeof row.toJSON === 'function' ? row.toJSON() : { ...row }) : { project_id: projectId, ...DEFAULT_SETTINGS };
  return {
    ...DEFAULT_SETTINGS,
    ...s,
    llm_max_concurrent: Number(s.llm_max_concurrent || 1),
    lane_min_interval_ms: Number(s.lane_min_interval_ms || 0),
    write_exceptions: json(s.write_exceptions, []),
    options: json(s.options, {}),
  };
}

class AgentService {
  assertP(p) {
    if (!p || !String(p).trim()) throw fail(400, 'project_id required');
  }

  async getSettings(projectId) {
    this.assertP(projectId);
    const rows = await AgentSettings.findAll({ where: { project_id: projectId } });
    const ser = serializeSettings(rows[0], projectId);
    gatewayFor(projectId, ser);
    return ser;
  }

  async updateSettings(projectId, body = {}) {
    this.assertP(projectId);
    const cur = await this.getSettings(projectId);
    const payload = {
      project_id: projectId,
      llm_max_concurrent: String(body.llm_max_concurrent ?? cur.llm_max_concurrent),
      lane_min_interval_ms: String(body.lane_min_interval_ms ?? cur.lane_min_interval_ms),
      workspace_worker_id: body.workspace_worker_id != null ? String(body.workspace_worker_id) : cur.workspace_worker_id,
      workspace_root: body.workspace_root != null ? String(body.workspace_root) : cur.workspace_root,
      write_policy: body.write_policy || cur.write_policy || 'ask_writes',
      write_exceptions: JSON.stringify(body.write_exceptions != null ? body.write_exceptions : cur.write_exceptions),
      notify_on_ask: body.notify_on_ask || cur.notify_on_ask || 'send',
      notify_on_done: body.notify_on_done || cur.notify_on_done || 'send',
      browser_url: body.browser_url != null ? String(body.browser_url) : (cur.browser_url || ''),
      options: JSON.stringify(body.options != null ? body.options : cur.options),
    };
    const rows = await AgentSettings.findAll({ where: { project_id: projectId } });
    if (rows[0]) await AgentSettings.update(rows[0].id, payload);
    else await AgentSettings.create(payload);
    return this.getSettings(projectId);
  }

  async create(body) {
    this.assertP(body.project_id);
    const name = String(body.name || '').trim();
    if (!isValidName(name)) throw fail(400, 'name must be lowercase alphanumeric with hyphens');
    const dup = await Agent.findAll({ where: { project_id: body.project_id, name } });
    if (dup.length) throw fail(409, 'name taken');
    const row = await Agent.create({
      project_id: body.project_id,
      name,
      type: body.type || 'icarus',
      mode: body.mode || 'ask',
      intelligence: String(body.intelligence || ''),
      memory: String(body.memory || `${name}-memory`),
      stt: String(body.stt || ''),
      tts: String(body.tts || ''),
      voice: String(body.voice || ''),
      timezone: String(body.timezone || 'America/Los_Angeles'),
      display_name: String(body.display_name || name),
      language: String(body.language || 'en'),
      state_db: String(body.state_db || `icarus-agent-${body.project_id.slice(0, 8)}`),
      storage_bucket: String(body.storage_bucket || 'icarus-agent'),
      rag_collection: String(body.rag_collection || `${name}-code`),
      user_id: String(body.user_id || ''),
      enabled: flag(body.enabled, 'true'),
      status: body.status || 'ready',
      arn: safeArn(body.project_id, 'agent', name),
      roll_refresh_sec: String(body.roll_refresh_sec ?? 900),
      notify_on_ask: String(body.notify_on_ask || 'send'),
      notify_on_done: String(body.notify_on_done || 'send'),
      options: JSON.stringify(body.options || {}),
    });
    await this.getSettings(body.project_id);
    return serializeAgent(row);
  }

  async list(projectId) {
    this.assertP(projectId);
    const rows = await Agent.findAll({ where: { project_id: projectId } });
    return rows.map(serializeAgent);
  }

  async get(id, projectId) {
    this.assertP(projectId);
    const rows = await Agent.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) throw fail(404, 'agent not found');
    return serializeAgent(rows[0]);
  }

  async getByName(projectId, name) {
    this.assertP(projectId);
    const rows = await Agent.findAll({ where: { project_id: projectId, name } });
    if (!rows.length) throw fail(404, 'agent not found');
    return serializeAgent(rows[0]);
  }

  async resolve(projectId, idOrName) {
    try { return await this.get(idOrName, projectId); } catch (e) {
      if (e.status !== 404) throw e;
      return this.getByName(projectId, idOrName);
    }
  }

  async update(id, projectId, body = {}) {
    const cur = await this.get(id, projectId);
    const patch = {};
    for (const k of [
      'mode', 'intelligence', 'memory', 'stt', 'tts', 'voice', 'timezone',
      'display_name', 'language', 'state_db', 'storage_bucket', 'rag_collection',
      'user_id', 'status', 'notify_on_ask', 'notify_on_done', 'type',
    ]) {
      if (body[k] != null) patch[k] = String(body[k]);
    }
    if (body.enabled != null) patch.enabled = flag(body.enabled, 'true');
    if (body.roll_refresh_sec != null) patch.roll_refresh_sec = String(body.roll_refresh_sec);
    if (body.options != null) patch.options = JSON.stringify(body.options);
    if (body.name && body.name !== cur.name) {
      if (!isValidName(body.name)) throw fail(400, 'invalid name');
      patch.name = body.name;
      patch.arn = safeArn(projectId, 'agent', body.name);
    }
    await Agent.update(cur.id, patch);
    return this.get(cur.id, projectId);
  }

  async del(id, projectId) {
    await this.get(id, projectId);
    await Agent.delete(id);
    return { deleted: true };
  }

  async listMessages(projectId, agentId, { limit = 50 } = {}) {
    const rows = await AgentMessage.findAll({ where: { project_id: projectId, agent_id: agentId } });
    return rows.slice(-Math.min(200, Number(limit) || 50));
  }

  async addMessage(projectId, agentId, { role, content, layer = 'user', job_id = '', ask_id = '' }) {
    const row = {
      project_id: projectId, agent_id: agentId, role, content: String(content || ''),
      layer, job_id,
    };
    if (ask_id) row.ask_id = ask_id;
    try {
      return await AgentMessage.create(row);
    } catch (e) {
      if (ask_id && /ask_id/.test(e.message || '')) {
        delete row.ask_id;
        return AgentMessage.create(row);
      }
      throw e;
    }
  }

  async completeJobMessage(projectId, agentId, jobId, content) {
    const id = String(jobId || '');
    const text = String(content || '').trim();
    if (!id || !text) return null;
    const rows = await AgentMessage.findAll({ where: { project_id: projectId, agent_id: agentId, job_id: id } });
    const hit = (rows || []).find((r) => r.role === 'assistant') || rows?.[0];
    if (!hit) {
      return this.addMessage(projectId, agentId, { role: 'assistant', content: text, layer: 'user', job_id: id });
    }
    await AgentMessage.update(hit.id, { content: text });
    const next = await AgentMessage.findAll({ where: { id: hit.id } });
    return next[0] || hit;
  }

  async listPins(projectId, agentId) {
    return AgentPin.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async pin(projectId, agentId, key, value) {
    const k = String(key || '').trim();
    if (!k) throw fail(400, 'key required');
    const existing = await AgentPin.findAll({ where: { project_id: projectId, agent_id: agentId, key: k } });
    if (existing[0]) {
      await AgentPin.update(existing[0].id, { value: String(value) });
      return AgentPin.findAll({ where: { id: existing[0].id } }).then((r) => r[0]);
    }
    return AgentPin.create({ project_id: projectId, agent_id: agentId, key: k, value: String(value) });
  }

  async forgetPin(projectId, agentId, key) {
    const rows = await AgentPin.findAll({ where: { project_id: projectId, agent_id: agentId, key } });
    for (const r of rows) await AgentPin.delete(r.id);
    return { forgotten: key };
  }

  async exportMemory(projectId, agentId) {
    const [pins, rolls, messages] = await Promise.all([
      this.listPins(projectId, agentId),
      AgentRoll.findAll({ where: { project_id: projectId, agent_id: agentId } }),
      this.listMessages(projectId, agentId, { limit: 500 }),
    ]);
    return { pins, rolls, messages };
  }

  async wipeMemory(projectId, agentId) {
    const [pins, rolls, messages] = await Promise.all([
      AgentPin.findAll({ where: { project_id: projectId, agent_id: agentId } }),
      AgentRoll.findAll({ where: { project_id: projectId, agent_id: agentId } }),
      AgentMessage.findAll({ where: { project_id: projectId, agent_id: agentId } }),
    ]);
    for (const r of [...pins, ...rolls, ...messages]) {
      const M = r.key != null && r.value != null && r.horizon == null
        ? (r.horizon !== undefined ? AgentRoll : AgentPin)
        : null;
      void M;
    }
    for (const r of pins) await AgentPin.delete(r.id);
    for (const r of rolls) await AgentRoll.delete(r.id);
    for (const r of messages) await AgentMessage.delete(r.id);
    return { wiped: true };
  }

  async getRolls(projectId, agentId) {
    const rows = await AgentRoll.findAll({ where: { project_id: projectId, agent_id: agentId } });
    const out = {};
    for (const r of rows) out[r.horizon] = r;
    return out;
  }

  async upsertRoll(projectId, agentId, horizon, body) {
    const existing = await AgentRoll.findAll({ where: { project_id: projectId, agent_id: agentId, horizon } });
    const payload = {
      project_id: projectId, agent_id: agentId, horizon, body: String(body), refreshed_at: new Date().toISOString(),
    };
    if (existing[0]) {
      await AgentRoll.update(existing[0].id, payload);
      const base = typeof existing[0].toJSON === 'function' ? existing[0].toJSON() : { ...existing[0] };
      return { ...base, ...payload };
    }
    return AgentRoll.create(payload);
  }

  async listWork(projectId, agentId) {
    return AgentWorkItem.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async createWork(projectId, agentId, body) {
    const shop = require('./AgentShop');
    return AgentWorkItem.create({
      project_id: projectId,
      agent_id: agentId,
      kind: body.kind || 'task',
      parent_id: body.parent_id || '',
      title: String(body.title || 'untitled'),
      status: body.status || 'queued',
      priority: String(body.priority || '3'),
      dod: String(body.dod || ''),
      assigned_worker_id: body.assigned_worker_id || '',
      relationships: JSON.stringify(shop.parseRelationships(body.relationships)),
      payload: JSON.stringify(body.payload || {}),
    });
  }

  async listAsks(projectId, agentId) {
    return AgentAsk.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async createAsk(projectId, agentId, {
    text, options = [], recommended, kind = 'generic', payload = {}, from_layer = 'user', speak_text = '',
  }) {
    const all = await this.listAsks(projectId, agentId);
    const open = all.filter((a) => a.status === 'open');
    const speak = speak_text || text;
    const dup = [...open, ...all.filter((a) => a.status === 'pending')].find((a) => a.kind === kind && a.text === text);
    if (dup) return dup;
    const opts = options.length ? options : ['Yes', 'No', 'Other'];
    const rec = recommended || opts[0];
    const status = open.length ? 'pending' : 'open';
    const ask = await AgentAsk.create({
      project_id: projectId,
      agent_id: agentId,
      text,
      options_json: JSON.stringify(opts),
      recommended: rec,
      status,
      answer: '',
      kind,
      payload: JSON.stringify(payload || {}),
      from_layer,
      speak_text: speak,
    });
    if (status === 'open') {
      try { emitAgentAsk(ask, projectId); } catch { /* */ }
      try { await this.notifyAsk(projectId, agentId, ask); } catch { /* queue-only */ }
    }
    try { await this.addTimeline(projectId, agentId, { layer: from_layer, type: 'ask', ref_id: ask.id, summary: text }); } catch { /* */ }
    return ask;
  }

  async promotePending(projectId, agentId) {
    const all = await this.listAsks(projectId, agentId);
    if (all.some((a) => a.status === 'open')) return null;
    const pending = all.filter((a) => a.status === 'pending')
      .sort((a, b) => String(a.created_at || a.id).localeCompare(String(b.created_at || b.id)));
    const next = pending[0];
    if (!next) return null;
    await AgentAsk.update(next.id, { status: 'open' });
    const nextBase = typeof next.toJSON === 'function' ? next.toJSON() : { ...next };
    const ask = { ...nextBase, status: 'open' };
    try { emitAgentAsk(ask, projectId); } catch { /* */ }
    try { await this.notifyAsk(projectId, agentId, ask); } catch { /* */ }
    return ask;
  }

  async notifyAsk(projectId, agentId, ask) {
    const shop = require('./AgentShop');
    const [settings, agent] = await Promise.all([
      this.getSettings(projectId),
      agentId ? this.get(agentId, projectId).catch(() => null) : null,
    ]);
    const mode = (agent && agent.notify_on_ask) || settings.notify_on_ask || 'send';
    if (mode === 'off') return { skipped: true };
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      await proxy('POST', `/api/services/queue_manager/api/v1/queues/${encodeURIComponent('agent-ask-inbox')}/messages`, {
        projectId,
        timeout: 5000,
        data: { project_id: projectId, body: { ask_id: ask.id, agent_id: agentId, text: ask.speak_text || ask.text, kind: ask.kind } },
      });
    } catch { /* queue optional */ }
    if (mode === 'queue_only') return { queued: true };
    if (!shop.shouldFanoutAsk(ask.kind)) return { queued: true, fanout: false };
    if (projectId === shop.PROD_PROJECT) return { skipped: true, reason: 'prod' };
    try {
      const { notify } = require('../../../../conductor/api/services/AlertFanout');
      await notify(projectId, {
        title: 'Icarus',
        body: `${ask.speak_text || ask.text} https://cloud.aerekos.com/services/ai_manager/agents`,
        severity: 'info',
      });
      return { queued: true, fanout: true };
    } catch (e) {
      return { queued: true, fanout: false, note: e.message || 'queue-only unless send secrets exist' };
    }
  }

  async notifyDone(projectId, agentId, { title, body, work_id } = {}) {
    const shop = require('./AgentShop');
    if (projectId === shop.PROD_PROJECT) return { skipped: true };
    const [settings, agent] = await Promise.all([
      this.getSettings(projectId),
      agentId ? this.get(agentId, projectId).catch(() => null) : null,
    ]);
    const mode = (agent && agent.notify_on_done) || settings.notify_on_done || 'send';
    if (mode === 'off') return { skipped: true };
    try {
      const { emitAgentDone } = require('../utils/aiLive');
      emitAgentDone({ agent_id: agentId, title, body, work_id }, projectId);
    } catch { /* */ }
    if (mode === 'queue_only') return { queued: true };
    try {
      const { notify } = require('../../../../conductor/api/services/AlertFanout');
      await notify(projectId, { title: title || 'Icarus', body: body || 'Done.', severity: 'info' });
      return { fanout: true };
    } catch (e) {
      return { fanout: false, note: e.message };
    }
  }

  async approve(projectId, agentId, askId, answer) {
    const rows = await AgentAsk.findAll({ where: { id: askId, project_id: projectId, agent_id: agentId } });
    if (!rows.length) throw fail(404, 'ask not found');
    const cur = rows[0];
    if (cur.status === 'open' && askId !== cur.id) {
      /* only the open card */
    }
    await AgentAsk.update(askId, { status: 'answered', answer: String(answer || '') });
    const curBase = typeof cur.toJSON === 'function' ? cur.toJSON() : { ...cur };
    const ask = { ...curBase, status: 'answered', answer: String(answer || '') };
    try { emitAgentAskAnswered(ask, projectId); } catch { /* */ }
    try { await this.addTimeline(projectId, agentId, { layer: 'user', type: 'ask.answered', ref_id: ask.id, summary: String(answer || '') }); } catch { /* */ }
    try { await this.promotePending(projectId, agentId); } catch { /* */ }
    return ask;
  }

  async cancelOpenAsks(projectId, agentId, { pending = false } = {}) {
    const rows = (await this.listAsks(projectId, agentId)).filter((a) => a.status === 'open' || (pending && a.status === 'pending'));
    for (const a of rows) {
      await AgentAsk.update(a.id, { status: 'cancelled' });
    }
    return { cancelled: rows.length };
  }

  async getPrompts(projectId, agentId) {
    const { bundled, effectivePrompts } = require('./defaultPrompts');
    const agent = await this.get(agentId, projectId);
    const opts = json(agent.options, {});
    return { defaults: bundled(), effective: effectivePrompts(opts), overrides: opts.prompts || {} };
  }

  async patchPrompts(projectId, agentId, prompts = {}) {
    const agent = await this.get(agentId, projectId);
    const opts = json(agent.options, {});
    opts.prompts = { ...(opts.prompts || {}), ...prompts };
    await Agent.update(agent.id, { options: JSON.stringify(opts) });
    return this.getPrompts(projectId, agent.id);
  }

  async resetPrompts(projectId, agentId) {
    const agent = await this.get(agentId, projectId);
    const opts = json(agent.options, {});
    delete opts.prompts;
    await Agent.update(agent.id, { options: JSON.stringify(opts) });
    return this.getPrompts(projectId, agent.id);
  }

  async reorderWork(projectId, agentId, ids = []) {
    const list = Array.isArray(ids) ? ids : [];
    for (let i = 0; i < list.length; i += 1) {
      await this.updateWork(list[i], { priority: String(i + 1) });
    }
    return this.listWork(projectId, agentId);
  }

  async shopBoard(projectId, agentId) {
    const shop = require('./AgentShop');
    const [work, workers, asks] = await Promise.all([
      this.listWork(projectId, agentId),
      this.listWorkers(projectId, agentId),
      this.listAsks(projectId, agentId),
    ]);
    const pr = workers.find((w) => /pr|review/i.test(String(w.status || '')) || String(w.compressed || '').includes('"pr"'));
    return shop.shopBoard({
      work, workers, asks,
      locks: {
        browser: (asks.find((a) => a.status === 'open' && a.kind === 'browse') || null)
          ? { agent_id: agentId } : null,
        pr: pr ? { worker_id: pr.id } : null,
      },
    });
  }

  async upsertBrief(projectId, agentId, body = {}) {
    const existing = await AgentBrief.findAll({ where: { project_id: projectId, agent_id: agentId } });
    const draft = existing.sort((a, b) => String(b.updated_at || b.created_at || '').localeCompare(String(a.updated_at || a.created_at || '')))[0];
    const row = {
      project_id: projectId,
      agent_id: agentId,
      goal: String(body.goal || draft?.goal || ''),
      done_when: String(body.done_when || draft?.done_when || ''),
      constraints_json: JSON.stringify(body.constraints || json(draft?.constraints_json, [])),
      unknowns_json: JSON.stringify(body.unknowns || json(draft?.unknowns_json, [])),
      client_words: String(body.client_words || body.goal || draft?.client_words || ''),
      status: body.status || 'submitted',
    };
    if (draft) {
      await AgentBrief.update(draft.id, row);
      return { ...draft, ...row, id: draft.id };
    }
    return AgentBrief.create(row);
  }

  async latestBrief(projectId, agentId) {
    const rows = await AgentBrief.findAll({ where: { project_id: projectId, agent_id: agentId } });
    return rows[rows.length - 1] || null;
  }

  async updateBrief(id, patch) {
    const next = { ...patch };
    if (patch.constraints) next.constraints_json = JSON.stringify(patch.constraints);
    if (patch.unknowns) next.unknowns_json = JSON.stringify(patch.unknowns);
    delete next.constraints;
    delete next.unknowns;
    await AgentBrief.update(id, next);
    const rows = await AgentBrief.findAll({ where: { id } });
    return rows[0];
  }

  async addTimeline(projectId, agentId, { layer = 'user', type, ref_id = '', summary = '' }) {
    return AgentTimeline.create({
      project_id: projectId,
      agent_id: agentId,
      at: new Date().toISOString(),
      layer,
      type: String(type || 'event'),
      ref_id: String(ref_id || ''),
      summary: String(summary || '').slice(0, 400),
    });
  }

  async listTimeline(projectId, agentId, { since } = {}) {
    const rows = await AgentTimeline.findAll({ where: { project_id: projectId, agent_id: agentId } });
    if (!since) return rows;
    return rows.filter((r) => String(r.at || r.created_at || '') >= String(since));
  }

  async updateWorker(id, patch) {
    await AgentWorker.update(id, patch);
    const rows = await AgentWorker.findAll({ where: { id } });
    return rows[0];
  }

  async updateWork(id, patch) {
    await AgentWorkItem.update(id, patch);
    const rows = await AgentWorkItem.findAll({ where: { id } });
    return rows[0];
  }

  async listWorkers(projectId, agentId) {
    return AgentWorker.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async createWorker(projectId, agentId, body = {}) {
    const claim = body.claim_prefix || '';
    if (claim) {
      const clash = await this.findClaim(projectId, agentId, claim);
      if (clash) throw fail(409, `worktree claimed by worker ${clash.id}`);
    }
    return AgentWorker.create({
      project_id: projectId,
      agent_id: agentId,
      work_item_id: body.work_item_id || '',
      persona: body.persona || 'dev',
      status: body.status || 'queued',
      objective: String(body.objective || ''),
      transcript: JSON.stringify(body.transcript || []),
      claim_prefix: claim,
      parent_worker_id: body.parent_worker_id || '',
      compressed: body.compressed || '',
      messages_json: JSON.stringify(body.messages || body.messages_json || []),
      retry_count: String(body.retry_count || 0),
      replan_count: String(body.replan_count || 0),
      chunk_grant: body.chunk_grant || '',
    });
  }

  async findClaim(projectId, agentId, prefix) {
    if (!prefix) return null;
    const shop = require('./AgentShop');
    const workers = await this.listWorkers(projectId, agentId);
    return shop.claimClash(workers, prefix) || null;
  }

  async claimWorktree(projectId, agentId, workerId, prefix) {
    const p = String(prefix || '').trim();
    if (!p) throw fail(400, 'claim_prefix required');
    const clash = await this.findClaim(projectId, agentId, p);
    if (clash && clash.id !== workerId) throw fail(409, `worktree claimed by worker ${clash.id}`);
    await AgentWorker.update(workerId, { claim_prefix: p });
    return { claimed: p, worker_id: workerId };
  }

  async sendInter(projectId, fromId, toId, content) {
    const dest = await this.resolve(projectId, toId);
    const src = await this.resolve(projectId, fromId);
    const text = String(content || '').trim();
    if (!text) throw fail(400, 'content required');
    await this.addMessage(projectId, dest.id, { role: 'assistant', content: text, layer: 'inter' });
    await this.addMessage(projectId, src.id, { role: 'user', content: `[to ${dest.name}] ${text}`, layer: 'inter' });
    return { from: src.id, to: dest.id };
  }

  async listCron(projectId, agentId) {
    return AgentCron.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async listAll() {
    const rows = await Agent.findAll({});
    return rows.map(serializeAgent);
  }

  async createCron(projectId, agentId, body) {
    return AgentCron.create({
      project_id: projectId,
      agent_id: agentId,
      name: String(body.name || 'job'),
      schedule: String(body.schedule || ''),
      handoff: JSON.stringify(body.handoff || {}),
      enabled: flag(body.enabled, 'true'),
      last_fired_at: '',
      kind: String(body.kind || (body.run_at ? 'once' : 'recurring')),
      run_at: String(body.run_at || ''),
      timezone: String(body.timezone || 'America/Los_Angeles'),
      last_error: '',
    });
  }

  async updateCron(cronId, patch = {}) {
    const row = {};
    for (const k of ['schedule', 'enabled', 'last_fired_at', 'kind', 'run_at', 'timezone', 'last_error', 'name']) {
      if (patch[k] != null) row[k] = String(patch[k]);
    }
    if (patch.handoff != null) row.handoff = typeof patch.handoff === 'string' ? patch.handoff : JSON.stringify(patch.handoff);
    await AgentCron.update(cronId, row);
    const rows = await AgentCron.findAll({ where: { id: cronId } });
    return rows[0];
  }

  async fireCron(projectId, agentId, cronId) {
    const rows = await AgentCron.findAll({ where: { id: cronId, project_id: projectId, agent_id: agentId } });
    if (!rows.length) throw fail(404, 'cron not found');
    return { fired: false, cron: rows[0], defer: true };
  }

  async listSkills(projectId, agentId) {
    return AgentSkill.findAll({ where: { project_id: projectId, agent_id: agentId } });
  }

  async createSkill(projectId, agentId, body) {
    return AgentSkill.create({
      project_id: projectId,
      agent_id: agentId,
      name: String(body.name || 'skill'),
      template: JSON.stringify(body.template || {}),
    });
  }

  async audit(projectId, agentId, { actor = 'system', kind, tool = '', meta = {} }) {
    return AgentAudit.create({
      project_id: projectId,
      agent_id: agentId || '',
      actor,
      kind,
      tool,
      meta: JSON.stringify(meta),
    });
  }

  async listAudit(projectId, agentId) {
    const where = { project_id: projectId };
    if (agentId) where.agent_id = agentId;
    return AgentAudit.findAll({ where });
  }

  async pulse(projectId, agentId) {
    const [agent, settings, asks, work, workers, gw, brief, timeline] = await Promise.all([
      this.get(agentId, projectId),
      this.getSettings(projectId),
      this.listAsks(projectId, agentId),
      this.listWork(projectId, agentId),
      this.listWorkers(projectId, agentId),
      Promise.resolve(gatewayFor(projectId)),
      this.latestBrief(projectId, agentId).catch(() => null),
      this.listTimeline(projectId, agentId).catch(() => []),
    ]);
    return {
      agent,
      settings,
      open_asks: asks.filter((a) => a.status === 'open'),
      pending_asks: asks.filter((a) => a.status === 'pending'),
      work,
      workers,
      locks: (await this.shopBoard(projectId, agentId).catch(() => ({}))).locks,
      brief,
      timeline: (timeline || []).slice(-40),
      gateway: gw.snapshot(),
      console: (() => {
        try {
          const Browser = require('./BrowserSession');
          return Browser.listConsole(projectId, agentId).slice(-12);
        } catch {
          return [];
        }
      })(),
    };
  }

  async fleet(projectId) {
    const agents = await this.list(projectId);
    const settings = await this.getSettings(projectId);
    const gw = gatewayFor(projectId, settings);
    const nodes = [];
    for (const a of agents) {
      const workers = await this.listWorkers(projectId, a.id);
      const work = await this.listWork(projectId, a.id);
      nodes.push({
        id: a.id,
        name: a.name,
        type: a.type,
        mode: a.mode,
        status: a.status,
        layers: {
          user: { status: 'ready' },
          manager: { work: work.filter((w) => w.status === 'running' || w.status === 'queued').length },
          workers: workers.map((w) => ({
            id: w.id, persona: w.persona, status: w.status, objective: w.objective,
          })),
        },
      });
    }
    return { settings, gateway: gw.snapshot(), agents: nodes };
  }
}

module.exports = { AgentService, serializeAgent, DEFAULT_SETTINGS };

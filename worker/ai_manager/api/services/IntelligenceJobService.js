'use strict';

const { IntelligenceJob } = require('../models');
const { IntelligenceService } = require('./IntelligenceService');
const { IntelligenceChatService } = require('./IntelligenceChatService');
const { emitJob, emitJobToken } = require('../utils/aiLive');
const { proxy } = require('../../../shared/conductorProxy');

function fail(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function parseJson(s, fallback) {
  if (s && typeof s === 'object') return s;
  try { return JSON.parse(s || ''); } catch { return fallback; }
}

class IntelligenceJobService {
  constructor(deps = {}) {
    this.Job = deps.Job || IntelligenceJob;
    this.intel = deps.intel || new IntelligenceService();
    this.chat = deps.chat || new IntelligenceChatService({ intel: this.intel });
    this._abort = new Map();
  }

  serialize(row) {
    return {
      id: row.id,
      project_id: row.project_id,
      intelligence: row.intelligence,
      status: row.status,
      request: parseJson(row.request, {}),
      result: parseJson(row.result, null),
      partial: row.partial || '',
      error: row.error || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  async submit(projectId, body = {}) {
    if (!projectId) throw fail(400, 'project_id required');
    const endpoint = await this.intel.getByName(projectId, body.intelligence || body.name);
    if ((endpoint.execution || 'sync') !== 'queued') throw fail(409, 'endpoint is not queued — PATCH execution: queued');
    const inbox = endpoint.queue_name || `${endpoint.name}-inbox`;
    const key = String(body.idempotency_key || body.message_id || '').trim();
    if (key) {
      const prior = await this.Job.findAll({ where: { project_id: projectId, idempotency_key: key } });
      if (prior.length) return this.serialize(prior[0]);
    }
    const request = {
      messages: body.messages,
      user_id: body.user_id || '',
      session_id: body.session_id || '',
      message_id: body.message_id || '',
      intelligence: endpoint.name,
      tools: body.tools,
      tool_choice: body.tool_choice,
      lane: body.lane || '',
      agent_id: body.agent_id || '',
      hangout: body.hangout || null,
    };
    const row = await this.Job.create({
      project_id: projectId,
      intelligence: endpoint.name,
      status: 'queued',
      request: JSON.stringify(request),
      result: '',
      partial: '',
      error: '',
      idempotency_key: key,
    });
    const saved = Array.isArray(row) ? row[0] : row;
    const pub = await proxy('POST', `/api/services/queue_manager/api/v1/queues/${encodeURIComponent(inbox)}/messages`, {
      projectId,
      timeout: 10000,
      data: { project_id: projectId, body: { job_id: saved.id } },
    });
    if (pub.status >= 400) {
      await this.Job.update(saved.id, { status: 'failed', error: pub.data?.error?.message || `enqueue ${pub.status}` });
      throw fail(502, 'failed to enqueue job');
    }
    emitJob(this.serialize(saved), projectId);
    return this.serialize(saved);
  }

  async get(id, projectId) {
    const rows = await this.Job.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) throw fail(404, 'job not found');
    return this.serialize(rows[0]);
  }

  async list(projectId, { intelligence, status, limit = 50, offset = 0 } = {}) {
    const where = { project_id: projectId };
    if (intelligence) where.intelligence = intelligence;
    if (status) where.status = status;
    const rows = await this.Job.findAll({ where });
    const sorted = rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
    return sorted.slice(Number(offset) || 0, (Number(offset) || 0) + Math.min(200, Number(limit) || 50)).map((r) => this.serialize(r));
  }

  async cancel(id, projectId) {
    const job = await this.get(id, projectId);
    if (['succeeded', 'failed', 'cancelled'].includes(job.status)) throw fail(409, 'job is already terminal');
    const ac = this._abort.get(id);
    if (ac) ac.abort();
    await this.Job.update(id, { status: 'cancelled', error: 'cancelled' });
    const next = await this.get(id, projectId);
    emitJob(next, projectId);
    return next;
  }

  async runJob(jobId) {
    const rows = await this.Job.findAll({ where: { id: jobId } });
    if (!rows.length) return { skipped: true, reason: 'missing' };
    const row = rows[0];
    if (row.status === 'succeeded' || row.status === 'cancelled') return { skipped: true, reason: row.status };
    if (row.status === 'failed') return { skipped: true, reason: 'failed' };
    if (row.status === 'running') return { skipped: true, reason: 'running' };
    const projectId = row.project_id;
    const req = parseJson(row.request, {});
    await this.Job.update(jobId, { status: 'running' });
    emitJob({ ...this.serialize(row), status: 'running' }, projectId);
    const ac = new AbortController();
    this._abort.set(jobId, ac);
    let lastWrite = 0;
    let partial = '';
    try {
      const result = await this.chat.chat(projectId, {
        body: req,
        params: {},
        query: {},
        headers: {},
        onDelta: (delta) => {
          if (ac.signal.aborted) return;
          partial += delta;
          emitJobToken({ job_id: jobId, delta, partial }, projectId);
          const now = Date.now();
          if (now - lastWrite > 100) {
            lastWrite = now;
            this.Job.update(jobId, { partial }).catch(() => {});
          }
        },
        abortSignal: ac.signal,
      });
      const finished = await this._hangoutReads(projectId, req, result, ac);
      if (ac.signal.aborted) {
        await this.Job.update(jobId, { status: 'cancelled', partial, error: 'cancelled' });
        return { cancelled: true };
      }
      await this.Job.update(jobId, {
        status: 'succeeded',
        result: JSON.stringify(finished),
        partial: finished?.message?.content || partial,
        error: '',
      });
      const done = await this.get(jobId, projectId);
      emitJob(done, projectId);
      const spoken = finished?.message?.content || finished?.response || partial;
      if (req.agent_id && req.lane === 'user' && spoken) {
        try {
          const { AgentService } = require('./AgentService');
          await new AgentService().completeJobMessage(projectId, req.agent_id, jobId, spoken);
        } catch { /* chat UI still has job tokens */ }
      }
      return { ok: true, job: done };
    } catch (e) {
      if (ac.signal.aborted) {
        await this.Job.update(jobId, { status: 'cancelled', partial, error: 'cancelled' });
        return { cancelled: true };
      }
      await this.Job.update(jobId, { status: 'failed', error: e.message || String(e), partial });
      emitJob({ id: jobId, status: 'failed', error: e.message }, projectId);
      return { ok: false, error: e.message };
    } finally {
      this._abort.delete(jobId);
    }
  }

  async reclaimStale(maxAgeMs = 2 * 60 * 60 * 1000) {
    const rows = await this.Job.findAll({ where: { status: 'running' } });
    const now = Date.now();
    let n = 0;
    for (const r of rows) {
      const t = r.updated_at ? new Date(r.updated_at).getTime() : 0;
      if (t && now - t > maxAgeMs) {
        await this.Job.update(r.id, { status: 'failed', error: 'stale running job reclaimed' });
        n += 1;
      }
    }
    return { reclaimed: n };
  }

  async _hangoutReads(projectId, req, result, ac) {
    if (req.lane !== 'user') return result;
    const { extractToolCalls, executeTool } = require('./workspaceTools');
    const shop = require('./AgentShop');
    const ALLOW = new Set(shop.HANGOUT_READ);
    const hangout = req.hangout || {};
    const root = hangout.workspace_root || process.cwd();
    const claim = String(hangout.claim || shop.SELF_CLAIM);
    const workerId = hangout.workspace_worker_id || '';
    let current = result;
    const messages = Array.isArray(req.messages) ? req.messages.slice() : [];
    for (let round = 0; round < 4; round++) {
      if (ac?.signal?.aborted) return current;
      const calls = extractToolCalls(current).filter((c) => ALLOW.has(c.name)).slice(0, 4);
      if (!calls.length) return current;
      const spoken = current?.message?.content || current?.response || '';
      if (spoken) messages.push({ role: 'assistant', content: String(spoken) });
      for (const c of calls) {
        const args = { ...(c.args || {}) };
        if (!args.path || args.path === '.') args.path = claim;
        else if (claim && !shop.pathUnderClaim(args.path, claim) && !String(args.path).startsWith(claim)) {
          args.path = `${claim.replace(/\/$/, '')}/${String(args.path).replace(/^\.?\//, '')}`;
        }
        let out;
        try {
          out = workerId
            ? await this._hangoutRemote(workerId, root, c.name, args)
            : executeTool(c.name, args, { root, projectId, persona: 'research' });
        } catch (e) {
          out = { ok: false, error: e.message };
        }
        messages.push({
          role: 'user',
          content: `Tool ${c.name} (${args.path || args.pattern || ''}) result:\n${JSON.stringify(out).slice(0, 6000)}`,
        });
      }
      current = await this.chat.chat(projectId, {
        body: { ...req, messages, tools: req.tools, tool_choice: 'auto' },
        params: {},
        query: {},
        headers: {},
        abortSignal: ac?.signal,
      });
    }
    return current;
  }

  async _hangoutRemote(workerId, root, name, args) {
    const { proxy } = require('../../../shared/conductorProxy');
    let inner = 'true';
    if (name === 'file_read') inner = `cat -- ${JSON.stringify(args.path || '')}`;
    else if (name === 'file_list') inner = `ls -1 -- ${JSON.stringify(args.path || '.')} | head -n 80`;
    else inner = `grep -R -n -- ${JSON.stringify(args.pattern || args.query || '')} ${JSON.stringify(args.path || '.')} | head -n 50 || true`;
    const full = `cd ${JSON.stringify(root)} && ${inner}`;
    const res = await proxy('POST', `/api/workers/${encodeURIComponent(workerId)}/containers/${encodeURIComponent('aerekos-icarus-workspace')}/exec`, {
      timeout: 30000,
      data: { cmd: ['sh', '-lc', full] },
    });
    if ((res.status || 200) >= 400) return { ok: false, computer_down: true, error: `computer exec HTTP ${res.status}` };
    return { ok: true, remote: true, stdout: String(res.data?.stdout || res.data?.output || '').slice(0, 8000) };
  }
}

module.exports = { IntelligenceJobService };

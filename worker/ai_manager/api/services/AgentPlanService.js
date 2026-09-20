'use strict';

const { looksLearn } = require('./AgentLearnService');

const TINY_PREVIEW = new Set(['folder', 'repo', 'browse', 'deploy', 'service', 'iac']);

function needsPlan(text, preview) {
  const t = String(text || '');
  const p = preview || {};
  if (TINY_PREVIEW.has(p.type)) return false;
  if (looksLearn(t)) return true;
  if (/\b(all|every|the whole system|make (it |the system )?better|improve|finish all e2e|integrate)\b/i.test(t)) {
    return true;
  }
  return false;
}

function inferPlanSteps(text) {
  const t = String(text || '');
  if (/make (it |the system )?better|\bimprove\b/i.test(t) && !/\be2e\b|\btest/i.test(t) && !looksLearn(t)) {
    return { steps: [], question: 'What does better mean — latency, tests, UI, or Icarus?' };
  }
  if (looksLearn(t) && /\bintegrate\b/i.test(t)) {
    return {
      steps: [
        { id: 's1', title: 'Ingest the paper or repo into skills if needed', kind: 'learn', status: 'queued' },
        { id: 's2', title: 'Design the slice in Computer', kind: 'code', status: 'queued' },
        { id: 's3', title: 'Open a PR (never prod UUID)', kind: 'code', status: 'queued' },
      ],
    };
  }
  if (looksLearn(t)) {
    return {
      steps: [
        { id: 's1', title: 'List sources', kind: 'learn', status: 'queued' },
        { id: 's2', title: 'ASK then ingest into skills', kind: 'learn', status: 'queued' },
      ],
    };
  }
  if (/\be2e\b/i.test(t) || /finish all .+tests/i.test(t)) {
    return {
      steps: [
        { id: 's1', title: 'Enumerate managers from the catalog (read-only)', kind: 'test', status: 'queued' },
        { id: 's2', title: 'ASK skip list (auth_manager, prod UUID, vLLM)', kind: 'test', status: 'queued' },
        { id: 's3', title: 'Add e2e for one manager at a time', kind: 'test', status: 'queued' },
      ],
    };
  }
  if (/\bintegrate\b/i.test(t)) {
    return {
      steps: [
        { id: 's1', title: 'Ingest source if not in skills', kind: 'learn', status: 'queued' },
        { id: 's2', title: 'Implement the slice', kind: 'code', status: 'queued' },
        { id: 's3', title: 'PR + tests for that slice', kind: 'code', status: 'queued' },
      ],
    };
  }
  return {
    steps: [{ id: 's1', title: t.slice(0, 160) || 'Do the asked work', kind: 'code', status: 'queued' }],
  };
}

function speakPlan(plan) {
  const steps = plan?.steps || [];
  const lines = steps.map((s, i) => `${i + 1}) ${s.title}`).join(' ');
  return lines ? `Here's the plan: ${lines} Run it?` : (plan?.question || 'Want me to plan that?');
}

function applyRevision(plan, note) {
  const next = { ...plan, revision: Number(plan.revision || 1) + 1, status: 'proposed' };
  const steps = [...(plan.steps || [])];
  const t = String(note || '');
  if (/\btests? first\b/i.test(t) || /\bdo tests first\b/i.test(t)) {
    const tests = steps.filter((s) => s.kind === 'test');
    const rest = steps.filter((s) => s.kind !== 'test');
    next.steps = tests.length ? [...tests, ...rest] : [{ id: 's0', title: 'Tests first', kind: 'test', status: 'queued' }, ...steps];
  }
  if (/skip auth_manager/i.test(t)) {
    next.constraints = [...(plan.constraints || []), 'skip auth_manager'];
  }
  next.origin_note = t;
  return next;
}

const MAX_PROACTIVE = 3;

class AgentPlanService {
  constructor(deps = {}) {
    this.plans = new Map();
    this._loaded = new Set();
    if (deps.Plan) this.Plan = deps.Plan;
    else if (deps.memory !== true) {
      const m = require('./agentModels').agentModels();
      if (m) this.Plan = m.AgentPlan;
    }
  }

  key(projectId, agentId) {
    return `${projectId}:${agentId}`;
  }

  _toRow(row) {
    return {
      origin: row.origin || '',
      origin_kind: row.origin_kind || 'user',
      status: row.status || 'drafting',
      revision: String(row.revision || 1),
      steps_json: JSON.stringify(row.steps || []),
      question: row.question || '',
      constraints_json: JSON.stringify(row.constraints || []),
    };
  }

  _fromRow(row) {
    if (!row) return null;
    const steps = typeof row.steps === 'object' && Array.isArray(row.steps)
      ? row.steps
      : (() => { try { return JSON.parse(row.steps_json || '[]'); } catch { return []; } })();
    const constraints = row.constraints || (() => { try { return JSON.parse(row.constraints_json || '[]'); } catch { return []; } })();
    return {
      ...row,
      revision: Number(row.revision || 1),
      steps,
      constraints,
    };
  }

  async ensureLoaded(projectId, agentId) {
    const k = this.key(projectId, agentId);
    if (this._loaded.has(k) || !this.Plan) return this.list(projectId, agentId);
    const rows = await this.Plan.findAll({ where: { project_id: projectId, agent_id: agentId } });
    this.plans.set(k, (rows || []).map((r) => this._fromRow(r)));
    this._loaded.add(k);
    return this.list(projectId, agentId);
  }

  list(projectId, agentId) {
    return this.plans.get(this.key(projectId, agentId)) || [];
  }

  get(projectId, agentId, id) {
    return this.list(projectId, agentId).find((p) => p.id === id) || null;
  }

  openProposed(projectId, agentId) {
    return this.list(projectId, agentId).filter((p) => p.status === 'proposed' || p.status === 'drafting' || p.status === 'asking');
  }

  async create(projectId, agentId, body = {}) {
    const row = {
      id: body.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      project_id: projectId,
      agent_id: agentId,
      origin: body.origin || body.origin_text || '',
      origin_kind: body.origin_kind || 'user',
      status: body.status || 'drafting',
      revision: Number(body.revision || 1),
      steps: body.steps || [],
      question: body.question || '',
      constraints: body.constraints || [],
      created_at: new Date().toISOString(),
    };
    if (this.Plan) {
      const created = await this.Plan.create({
        project_id: projectId,
        agent_id: agentId,
        ...this._toRow(row),
      });
      row.id = created.id;
      row.created_at = created.created_at || row.created_at;
    }
    const k = this.key(projectId, agentId);
    const arr = this.plans.get(k) || [];
    arr.push(row);
    this.plans.set(k, arr);
    return row;
  }

  async update(projectId, agentId, id, patch) {
    const arr = this.list(projectId, agentId);
    const row = arr.find((p) => p.id === id);
    if (!row) return null;
    Object.assign(row, patch);
    if (this.Plan) {
      try { await this.Plan.update(id, this._toRow(row)); } catch { /* */ }
    }
    return row;
  }

  canProposeIdle(projectId, agentId) {
    return this.openProposed(projectId, agentId).filter((p) => p.origin_kind === 'idle').length < MAX_PROACTIVE;
  }

  dedupeIdle(projectId, agentId, title) {
    const t = String(title || '').toLowerCase();
    return this.openProposed(projectId, agentId).some((p) => String(p.steps?.[0]?.title || p.origin || '').toLowerCase() === t);
  }
}

module.exports = {
  AgentPlanService,
  needsPlan,
  inferPlanSteps,
  speakPlan,
  applyRevision,
  TINY_PREVIEW,
  MAX_PROACTIVE,
};

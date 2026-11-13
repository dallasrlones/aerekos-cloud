'use strict';

const { randomUUID } = require('crypto');
const { withSession, isConfigured } = require('./Neo4jDriver');
const { LABELS, RELS, CONSTRAINTS } = require('./GraphSchema');

/**
 * Neo4j plan-as-graph system of record.
 * readySet: tasks with status=ready OR (pending and all BEFORE predecessors done).
 */

async function ensureSchema() {
  if (!isConfigured()) return { ok: false, reason: 'not_configured' };
  await withSession(async (session) => {
    for (const stmt of CONSTRAINTS.split(';').map((s) => s.trim()).filter(Boolean)) {
      try { await session.run(stmt); } catch { /* already exists / enterprise */ }
    }
  });
  return { ok: true };
}

function nodeProps(row, key = 'n') {
  return row.get(key)?.properties || null;
}

class PlanGraphStore {
  constructor({ projectId }) {
    this.projectId = String(projectId || '');
  }

  assertConfigured() {
    if (!isConfigured()) {
      const e = new Error('Neo4j not configured (set NEO4J_URI)');
      e.status = 503;
      e.code = 'NEO4J_NOT_CONFIGURED';
      throw e;
    }
  }

  async createPlan({ title, goal, agentId, meta } = {}) {
    this.assertConfigured();
    const id = randomUUID();
    const now = Date.now();
    await withSession(async (session) => {
      await session.run(
        `MERGE (proj:${LABELS.Project} {id: $projectId})
         CREATE (p:${LABELS.Plan} {
           id: $id, project_id: $projectId, title: $title, goal: $goal,
           status: 'active', created_at: $now, updated_at: $now, agent_id: $agentId, meta: $meta
         })
         MERGE (proj)-[:${RELS.HAS_PLAN}]->(p)
         RETURN p`,
        {
          projectId: this.projectId,
          id,
          title: title || 'Untitled plan',
          goal: goal || '',
          agentId: agentId || '',
          now,
          meta: JSON.stringify(meta || {}),
        },
      );
    });
    return this.getPlan(id);
  }

  async getPlan(planId) {
    this.assertConfigured();
    return withSession(async (session) => {
      const r = await session.run(
        `MATCH (p:${LABELS.Plan} {id: $id, project_id: $projectId}) RETURN p`,
        { id: planId, projectId: this.projectId },
      );
      if (!r.records.length) return null;
      return normalizePlan(nodeProps(r.records[0], 'p'));
    });
  }

  async listPlans() {
    this.assertConfigured();
    return withSession(async (session) => {
      const r = await session.run(
        `MATCH (p:${LABELS.Plan} {project_id: $projectId})
         RETURN p ORDER BY p.updated_at DESC LIMIT 100`,
        { projectId: this.projectId },
      );
      return r.records.map((rec) => normalizePlan(nodeProps(rec, 'p')));
    });
  }

  async addTask(planId, {
    title, description, priority = 0, status = 'pending', parentId, agentId, kind, meta,
  } = {}) {
    this.assertConfigured();
    const id = randomUUID();
    const now = Date.now();
    await withSession(async (session) => {
      await session.run(
        `MATCH (p:${LABELS.Plan} {id: $planId, project_id: $projectId})
         CREATE (t:${LABELS.Task} {
           id: $id, project_id: $projectId, plan_id: $planId, title: $title,
           description: $description, priority: $priority, status: $status,
           created_at: $now, updated_at: $now, agent_id: $agentId, kind: $kind, meta: $meta
         })
         CREATE (p)-[:${RELS.CONTAINS}]->(t)
         RETURN t`,
        {
          planId,
          projectId: this.projectId,
          id,
          title: title || 'task',
          description: description || '',
          priority: Number(priority) || 0,
          status,
          now,
          agentId: agentId || '',
          kind: kind || 'work',
          meta: JSON.stringify(meta || {}),
        },
      );
      if (parentId) {
        await session.run(
          `MATCH (parent:${LABELS.Task} {id: $parentId}), (t:${LABELS.Task} {id: $id})
           MERGE (parent)-[:${RELS.PARENT}]->(t)`,
          { parentId, id },
        );
      }
    });
    return this.getTask(id);
  }

  async getTask(taskId) {
    this.assertConfigured();
    return withSession(async (session) => {
      const r = await session.run(
        `MATCH (t:${LABELS.Task} {id: $id, project_id: $projectId}) RETURN t`,
        { id: taskId, projectId: this.projectId },
      );
      if (!r.records.length) return null;
      return normalizeTask(nodeProps(r.records[0], 't'));
    });
  }

  async setTaskStatus(taskId, status, extra = {}) {
    this.assertConfigured();
    const now = Date.now();
    await withSession(async (session) => {
      await session.run(
        `MATCH (t:${LABELS.Task} {id: $id, project_id: $projectId})
         SET t.status = $status, t.updated_at = $now,
             t.result = coalesce($result, t.result),
             t.error = coalesce($error, t.error)
         RETURN t`,
        {
          id: taskId,
          projectId: this.projectId,
          status,
          now,
          result: extra.result != null ? JSON.stringify(extra.result) : null,
          error: extra.error || null,
        },
      );
    });
    const task = await this.getTask(taskId);
    const { emitTaskAndGraph } = require('./graphEmit');
    emitTaskAndGraph(this, task);
    return task;
  }

  async linkBefore(fromTaskId, toTaskId) {
    return this._rel(fromTaskId, toTaskId, RELS.BEFORE);
  }

  async linkParallel(a, b) {
    return this._rel(a, b, RELS.PARALLEL);
  }

  async linkMutex(a, b) {
    return this._rel(a, b, RELS.MUTEX);
  }

  async invalidate(fromId, toId, reason = '') {
    this.assertConfigured();
    await withSession(async (session) => {
      await session.run(
        `MATCH (a {id: $fromId}), (b {id: $toId})
         MERGE (a)-[r:${RELS.INVALIDATES}]->(b)
         SET r.reason = $reason, r.at = $now
         WITH b
         SET b.status = 'invalidated', b.updated_at = $now`,
        {
          fromId, toId, reason, now: Date.now(),
        },
      );
    });
  }

  async assignTask(taskId, agentId) {
    this.assertConfigured();
    await withSession(async (session) => {
      await session.run(
        `MATCH (t:${LABELS.Task} {id: $taskId})
         MERGE (a:${LABELS.Agent} {id: $agentId, project_id: $projectId})
         MERGE (t)-[:${RELS.ASSIGNED_TO}]->(a)
         SET t.agent_id = $agentId, t.updated_at = $now`,
        {
          taskId, agentId, projectId: this.projectId, now: Date.now(),
        },
      );
    });
  }

  async attachWorldFact(entityId, fact) {
    this.assertConfigured();
    const id = randomUUID();
    await withSession(async (session) => {
      await session.run(
        `MATCH (e {id: $entityId})
         CREATE (f:${LABELS.WorldFact} {
           id: $id, project_id: $projectId, text: $text, created_at: $now, meta: $meta
         })
         CREATE (e)-[:${RELS.ATTACHES}]->(f)`,
        {
          entityId,
          id,
          projectId: this.projectId,
          text: fact.text || String(fact),
          now: Date.now(),
          meta: JSON.stringify(fact.meta || {}),
        },
      );
    });
    return { id };
  }

  /**
   * Tasks ready to schedule: status ready, or pending with all BEFORE preds done,
   * and no active MUTEX peer running.
   */
  async readySet(planId = null) {
    this.assertConfigured();
    return withSession(async (session) => {
      const r = await session.run(
        `MATCH (t:${LABELS.Task} {project_id: $projectId})
         WHERE ($planId IS NULL OR t.plan_id = $planId)
           AND t.status IN ['pending', 'ready']
           AND NOT EXISTS {
             MATCH (pred:${LABELS.Task})-[:${RELS.BEFORE}]->(t)
             WHERE pred.status <> 'done'
           }
           AND NOT EXISTS {
             MATCH (t)-[:${RELS.MUTEX}]-(peer:${LABELS.Task})
             WHERE peer.status = 'running'
           }
         RETURN t
         ORDER BY t.priority DESC, t.created_at ASC
         LIMIT 200`,
        { projectId: this.projectId, planId: planId || null },
      );
      return r.records.map((rec) => normalizeTask(nodeProps(rec, 't')));
    });
  }

  async listPhases(planId) {
    const sub = await this.subgraph(planId);
    return sub.tasks.filter((t) => t.kind === 'phase');
  }

  async taskHierarchy(planId) {
    const sub = await this.subgraph(planId);
    return buildTaskHierarchy(sub.tasks, sub.edges);
  }

  async projectHierarchy() {
    const plans = await this.listPlans();
    const out = { project_id: this.projectId, plans: [] };
    for (const plan of plans) {
      const tree = await this.taskHierarchy(plan.id);
      out.plans.push({
        ...plan,
        phases: tree.phases,
        tasks: tree.tasks,
        hierarchy: tree.roots,
      });
    }
    return out;
  }

  async subgraph(planId) {
    this.assertConfigured();
    return withSession(async (session) => {
      const tasks = await session.run(
        `MATCH (p:${LABELS.Plan} {id: $planId})-[:${RELS.CONTAINS}]->(t:${LABELS.Task})
         RETURN t`,
        { planId },
      );
      const edges = await session.run(
        `MATCH (p:${LABELS.Plan} {id: $planId})-[:${RELS.CONTAINS}]->(a:${LABELS.Task})
         MATCH (a)-[r]->(b:${LABELS.Task})
         WHERE type(r) IN ['${RELS.BEFORE}', '${RELS.PARALLEL}', '${RELS.MUTEX}', '${RELS.INVALIDATES}', '${RELS.PARENT}']
         RETURN a.id AS from_id, b.id AS to_id, type(r) AS type`,
        { planId },
      );
      return {
        plan: await this.getPlan(planId),
        tasks: tasks.records.map((rec) => normalizeTask(nodeProps(rec, 't'))),
        edges: edges.records.map((rec) => ({
          from: rec.get('from_id'),
          to: rec.get('to_id'),
          type: rec.get('type'),
        })),
      };
    });
  }

  async queryUser({ cypher, params = {} } = {}) {
    this.assertConfigured();
    // Allow only read patterns for user-facing tools — no DELETE/DETACH/DROP
    const q = String(cypher || '').trim();
    if (!q || /\b(DELETE|DETACH|DROP|CREATE\s+CONSTRAINT|LOAD\s+CSV)\b/i.test(q)) {
      const e = new Error('Only safe read Cypher allowed for user query tools');
      e.status = 400;
      throw e;
    }
    return withSession(async (session) => {
      const r = await session.run(q, { ...params, projectId: this.projectId });
      return r.records.map((rec) => {
        const o = {};
        rec.keys.forEach((k) => { o[k] = neoVal(rec.get(k)); });
        return o;
      });
    });
  }

  async recordDecision({
    planId, taskId, why, inputs, outputs,
  }) {
    this.assertConfigured();
    const id = randomUUID();
    await withSession(async (session) => {
      await session.run(
        `CREATE (d:${LABELS.Decision} {
           id: $id, project_id: $projectId, plan_id: $planId, task_id: $taskId,
           why: $why, inputs: $inputs, outputs: $outputs, created_at: $now
         })
         WITH d
         OPTIONAL MATCH (t:${LABELS.Task} {id: $taskId})
         FOREACH (_ IN CASE WHEN t IS NULL THEN [] ELSE [1] END |
           CREATE (d)-[:${RELS.EXPLAINS}]->(t)
         )`,
        {
          id,
          projectId: this.projectId,
          planId: planId || '',
          taskId: taskId || '',
          why: why || '',
          inputs: JSON.stringify(inputs || {}),
          outputs: JSON.stringify(outputs || {}),
          now: Date.now(),
        },
      );
    });
    return { id };
  }

  async createCheckpoint({ planId, label, snapshot }) {
    this.assertConfigured();
    const id = randomUUID();
    await withSession(async (session) => {
      await session.run(
        `MATCH (p:${LABELS.Plan} {id: $planId})
         CREATE (c:${LABELS.Checkpoint} {
           id: $id, project_id: $projectId, plan_id: $planId, label: $label,
           snapshot: $snapshot, created_at: $now
         })
         CREATE (c)-[:${RELS.CHECKPOINT_OF}]->(p)`,
        {
          id,
          projectId: this.projectId,
          planId,
          label: label || 'checkpoint',
          snapshot: JSON.stringify(snapshot || {}),
          now: Date.now(),
        },
      );
    });
    return { id };
  }

  async _rel(a, b, type) {
    this.assertConfigured();
    await withSession(async (session) => {
      await session.run(
        `MATCH (x:${LABELS.Task} {id: $a}), (y:${LABELS.Task} {id: $b})
         MERGE (x)-[:${type}]->(y)`,
        { a, b },
      );
    });
  }
}

function normalizePlan(p) {
  if (!p) return null;
  return {
    id: p.id,
    project_id: p.project_id,
    title: p.title,
    goal: p.goal,
    status: p.status,
    agent_id: p.agent_id,
    created_at: p.created_at,
    updated_at: p.updated_at,
    meta: safeJson(p.meta),
  };
}

function normalizeTask(t) {
  if (!t) return null;
  return {
    id: t.id,
    project_id: t.project_id,
    plan_id: t.plan_id,
    title: t.title,
    description: t.description,
    priority: t.priority,
    status: t.status,
    agent_id: t.agent_id,
    kind: t.kind,
    created_at: t.created_at,
    updated_at: t.updated_at,
    result: safeJson(t.result),
    error: t.error || null,
    meta: safeJson(t.meta),
  };
}

function safeJson(v) {
  if (v == null || v === '') return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return {}; }
}

/** Nested task tree from PARENT edges (phase → task → subtask). */
function buildTaskHierarchy(tasks, edges) {
  const nodes = new Map();
  for (const t of tasks) {
    nodes.set(t.id, { ...t, children: [] });
  }
  const childIds = new Set();
  for (const e of edges) {
    if (e.type !== RELS.PARENT) continue;
    const parent = nodes.get(e.from);
    const child = nodes.get(e.to);
    if (!parent || !child) continue;
    parent.children.push(child);
    childIds.add(e.to);
  }
  const roots = [...nodes.values()].filter((n) => !childIds.has(n.id));
  return {
    roots,
    phases: roots.filter((n) => n.kind === 'phase'),
    tasks: roots.filter((n) => n.kind !== 'phase'),
  };
}

function neoVal(v) {
  if (v == null) return null;
  if (typeof v === 'object' && v.properties) return v.properties;
  return v;
}

/** In-memory store for unit tests when Neo4j is unavailable. */
class MemoryPlanGraphStore {
  constructor({ projectId }) {
    this.projectId = String(projectId || '');
    this.plans = new Map();
    this.tasks = new Map();
    this.edges = [];
    /** Indexes for O(1) readySet preds / mutex (bench + live UI). */
    this.beforeTo = new Map(); // toId -> fromId[]
    this.mutexOf = new Map(); // id -> peerId[]
    this.decisions = [];
    this.checkpoints = [];
  }

  _indexEdge(e) {
    if (e.type === RELS.BEFORE) {
      if (!this.beforeTo.has(e.to)) this.beforeTo.set(e.to, []);
      this.beforeTo.get(e.to).push(e.from);
    } else if (e.type === RELS.MUTEX) {
      if (!this.mutexOf.has(e.from)) this.mutexOf.set(e.from, []);
      if (!this.mutexOf.has(e.to)) this.mutexOf.set(e.to, []);
      this.mutexOf.get(e.from).push(e.to);
      this.mutexOf.get(e.to).push(e.from);
    }
  }

  async createPlan({ title, goal, agentId, meta } = {}) {
    const id = randomUUID();
    const now = Date.now();
    const p = {
      id,
      project_id: this.projectId,
      title: title || 'Untitled',
      goal: goal || '',
      status: 'active',
      agent_id: agentId || '',
      created_at: now,
      updated_at: now,
      meta: meta || {},
    };
    this.plans.set(id, p);
    return p;
  }

  async getPlan(id) { return this.plans.get(id) || null; }
  async listPlans() { return [...this.plans.values()]; }

  async addTask(planId, opts = {}) {
    const id = randomUUID();
    const now = Date.now();
    const t = {
      id,
      project_id: this.projectId,
      plan_id: planId,
      title: opts.title || 'task',
      description: opts.description || '',
      priority: Number(opts.priority) || 0,
      status: opts.status || 'pending',
      agent_id: opts.agentId || '',
      kind: opts.kind || 'work',
      created_at: now,
      updated_at: now,
      result: null,
      error: null,
      meta: opts.meta || {},
    };
    this.tasks.set(id, t);
    if (opts.parentId) {
      const e = { from: opts.parentId, to: id, type: RELS.PARENT };
      this.edges.push(e);
      this._indexEdge(e);
    }
    return t;
  }

  async getTask(id) { return this.tasks.get(id) || null; }

  async setTaskStatus(id, status, extra = {}) {
    const t = this.tasks.get(id);
    if (!t) return null;
    t.status = status;
    t.updated_at = Date.now();
    if (extra.result != null) t.result = extra.result;
    if (extra.error != null) t.error = extra.error;
    // status history for scrubber / historical replay
    if (!t.status_history) t.status_history = [];
    t.status_history.push({ status, at: t.updated_at });
    const { emitTaskAndGraph } = require('./graphEmit');
    emitTaskAndGraph(this, t);
    return t;
  }

  async linkBefore(a, b) {
    const e = { from: a, to: b, type: RELS.BEFORE };
    this.edges.push(e);
    this._indexEdge(e);
  }

  async linkParallel(a, b) {
    this.edges.push({ from: a, to: b, type: RELS.PARALLEL });
  }

  async linkMutex(a, b) {
    const e = { from: a, to: b, type: RELS.MUTEX };
    this.edges.push(e);
    this._indexEdge(e);
  }

  async invalidate(fromId, toId) {
    this.edges.push({ from: fromId, to: toId, type: RELS.INVALIDATES });
    const t = this.tasks.get(toId);
    if (t) { t.status = 'invalidated'; t.updated_at = Date.now(); }
  }

  async assignTask(taskId, agentId) {
    const t = this.tasks.get(taskId);
    if (t) t.agent_id = agentId;
  }

  async attachWorldFact() { return { id: randomUUID() }; }

  async readySet(planId = null) {
    const out = [];
    for (const t of this.tasks.values()) {
      if (planId && t.plan_id !== planId) continue;
      if (!['pending', 'ready'].includes(t.status)) continue;
      const preds = this.beforeTo.get(t.id) || [];
      let blocked = false;
      for (const from of preds) {
        if (this.tasks.get(from)?.status !== 'done') { blocked = true; break; }
      }
      if (blocked) continue;
      const peers = this.mutexOf.get(t.id) || [];
      if (peers.some((peer) => this.tasks.get(peer)?.status === 'running')) continue;
      out.push(t);
    }
    return out.sort((a, b) => b.priority - a.priority || a.created_at - b.created_at);
  }

  async listPhases(planId) {
    const sub = await this.subgraph(planId);
    return sub.tasks.filter((t) => t.kind === 'phase');
  }

  async taskHierarchy(planId) {
    const sub = await this.subgraph(planId);
    return buildTaskHierarchy(sub.tasks, sub.edges);
  }

  async projectHierarchy() {
    const plans = await this.listPlans();
    const out = { project_id: this.projectId, plans: [] };
    for (const plan of plans) {
      const tree = await this.taskHierarchy(plan.id);
      out.plans.push({
        ...plan,
        phases: tree.phases,
        tasks: tree.tasks,
        hierarchy: tree.roots,
      });
    }
    return out;
  }

  async subgraph(planId) {
    return {
      plan: this.plans.get(planId),
      tasks: [...this.tasks.values()].filter((t) => t.plan_id === planId),
      edges: this.edges.filter((e) => {
        const a = this.tasks.get(e.from);
        const b = this.tasks.get(e.to);
        return a?.plan_id === planId || b?.plan_id === planId;
      }),
    };
  }

  async queryUser({ cypher } = {}) {
    const q = String(cypher || '').trim();
    if (!q || /\b(DELETE|DETACH|DROP|CREATE\s+CONSTRAINT|LOAD\s+CSV)\b/i.test(q)) {
      const e = new Error('Only safe read Cypher allowed for user query tools');
      e.status = 400;
      throw e;
    }
    // Memory stand-in: list plans/tasks for read-shaped queries
    if (/\bTask\b/i.test(q)) {
      return [...this.tasks.values()].map((t) => ({ t }));
    }
    return [...this.plans.values()].map((p) => ({ p }));
  }

  async recordDecision(d) {
    const id = randomUUID();
    this.decisions.push({ id, ...d, created_at: Date.now() });
    return { id };
  }

  async createCheckpoint({ planId, label, snapshot }) {
    const id = randomUUID();
    this.checkpoints.push({
      id, planId, label, snapshot, created_at: Date.now(),
    });
    return { id };
  }
}

function createPlanGraphStore(projectId, { forceMemory = false } = {}) {
  if (forceMemory || !isConfigured() || process.env.ICARUS_GRAPH_MEMORY === '1') {
    return new MemoryPlanGraphStore({ projectId });
  }
  return new PlanGraphStore({ projectId });
}

module.exports = {
  PlanGraphStore,
  MemoryPlanGraphStore,
  createPlanGraphStore,
  ensureSchema,
  buildTaskHierarchy,
  LABELS,
  RELS,
};

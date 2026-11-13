'use strict';

const { Task } = require('../models');
const { TaskService } = require('./TaskService');
const {
  normalizeWorkload,
  workloadFromTaskRow,
  actualFromTaskRow,
  diffWorkload,
  planRollingReplace,
  parseJson,
} = require('./workloadSpec');
const { DeploymentController } = require('./DeploymentController');

class DesiredStateService {
  /**
   * @param {{ Task?: typeof Task, taskService?: TaskService, journal?: Map, deployments?: DeploymentController }} [deps]
   */
  constructor(deps = {}) {
    this.Task = deps.Task || Task;
    this.taskService = deps.taskService || new TaskService({ Task: this.Task });
    this.journal = deps.journal || new Map();
    this._loopHandles = new Map();
    this.deployments = deps.deployments || new DeploymentController({
      Task: this.Task,
      taskService: this.taskService,
    });
  }

  assertProjectId(projectId) {
    if (!projectId || !String(projectId).trim()) {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.Task.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('task not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async setDesired(id, projectId, body) {
    const row = await this.getById(id, projectId);
    const workload = normalizeWorkload(body, { name: row.name, image: row.image });
    const resourcePatch = workload.resources && Object.keys(workload.resources).length
      ? { resource_limits: JSON.stringify(workload.resources) }
      : {};
    await this.Task.update(id, {
      workload_spec: JSON.stringify(workload),
      image: workload.image,
      desired: workload.replicas,
      ...resourcePatch,
    });
    return workload;
  }

  reconcileRow(row) {
    const desired = workloadFromTaskRow(row);
    const actual = actualFromTaskRow(row);
    const drift = diffWorkload(desired, actual);
    const record = {
      task_id: row.id,
      project_id: row.project_id,
      name: row.name,
      desired,
      actual,
      drift,
      at: new Date().toISOString(),
    };
    const key = `${row.project_id}:${row.id}`;
    const prior = this.journal.get(key) || [];
    prior.push(record);
    this.journal.set(key, prior.slice(-32));
    try {
      this.Task.update(row.id, {
        reconcile_snapshot: JSON.stringify(record),
      });
    } catch { /* column may be absent in old tests */ }
    return record;
  }

  async reconcileTask(id, projectId) {
    const row = await this.getById(id, projectId);
    return this.reconcileRow(row);
  }

  async reconcileProject(projectId) {
    this.assertProjectId(projectId);
    const rows = await this.Task.findAll({ where: { project_id: projectId } });
    return rows.map((row) => this.reconcileRow(row));
  }

  /**
   * Stub reconcile loop: one pass that records desired vs actual (no background daemon).
   */
  async runReconcileLoop(projectId, { intervalMs = 0, passes = 1 } = {}) {
    const n = Math.max(1, Number(passes) || 1);
    const out = [];
    for (let i = 0; i < n; i += 1) {
      out.push(...(await this.reconcileProject(projectId)));
      if (intervalMs > 0 && i < n - 1) {
        await new Promise((r) => { setTimeout(r, intervalMs); });
      }
    }
    return { passes: n, records: out };
  }

  getJournal(projectId, taskId) {
    return this.journal.get(`${projectId}:${taskId}`) || [];
  }

  planReplace(row, nextWorkload) {
    return planRollingReplace(row.image, nextWorkload, { maxSurge: 1 });
  }

  async rollingReplace(id, projectId, body, opts = {}) {
    // Prefer Deployment controller (aerekos Compute / our K8s)
    const applied = await this.deployments.apply(id, projectId, {
      replicas: body.replicas,
      strategy: body.strategy || { type: 'RollingUpdate', maxSurge: 1, maxUnavailable: 0 },
      progressDeadlineSeconds: body.progressDeadlineSeconds,
      template: body,
    });
    const reconciled = await this.deployments.reconcile(id, projectId, {
      forceFailReady: Boolean(opts.forceFailReady || body.force_fail_ready),
    });
    return {
      deployment: applied.deployment,
      status: reconciled.status,
      aborted: reconciled.aborted,
      plan: reconciled.plan,
      results: reconciled.results || [],
      reconcile: this.reconcileRow(await this.getById(id, projectId)),
    };
  }

  stopReconcileLoop(projectId) {
    const h = this._loopHandles.get(projectId);
    if (h) {
      clearInterval(h);
      this._loopHandles.delete(projectId);
    }
  }
}

module.exports = { DesiredStateService };

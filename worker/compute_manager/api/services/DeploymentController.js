'use strict';

const { Task } = require('../models');
const { TaskService } = require('./TaskService');
const {
  normalizeDeployment,
  deploymentFromTaskRow,
  emptyStatus,
  setCondition,
  planDeploymentRollout,
  shouldAbortRollout,
  buildStatus,
  CONDITIONS,
  parseJson,
} = require('./deploymentSpec');

/**
 * Continuous Deployment controller — aerekos Compute (our Kubernetes).
 * Node agent applies via TaskService / Docker when SKIP_DOCKER is unset.
 */
class DeploymentController {
  /**
   * @param {{ Task?: typeof Task, taskService?: TaskService, clock?: () => number }} [deps]
   */
  constructor(deps = {}) {
    this.Task = deps.Task || Task;
    this.taskService = deps.taskService || new TaskService({ Task: this.Task });
    this.clock = deps.clock || (() => Date.now());
    this.revisions = deps.revisions || new Map(); // taskId -> Deployment[]
    this._loops = new Map();
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
      const e = new Error('deployment not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  _revKey(projectId, id) {
    return `${projectId}:${id}`;
  }

  _pushRevision(projectId, id, dep) {
    const key = this._revKey(projectId, id);
    const list = this.revisions.get(key) || [];
    const revision = list.length + 1;
    const copy = JSON.parse(JSON.stringify(dep));
    copy.metadata = { ...(copy.metadata || {}), revision };
    list.push(copy);
    this.revisions.set(key, list.slice(-32));
    return revision;
  }

  listRevisions(projectId, id) {
    return this.revisions.get(this._revKey(projectId, id)) || [];
  }

  async apply(id, projectId, body) {
    const row = await this.getById(id, projectId);
    const dep = normalizeDeployment(body, { name: row.name, image: row.image });
    const revision = this._pushRevision(projectId, id, dep);
    const status = buildStatus({
      generation: revision,
      revision,
      desired: dep.spec.replicas,
      ready: 0,
      conditions: setCondition([], CONDITIONS.Progressing, true, 'NewRevision', 'Rolling toward new revision'),
      rolloutState: dep.spec.paused ? 'Paused' : 'Progressing',
      rolloutStartedAt: new Date(this.clock()).toISOString(),
    });
    await this.Task.update(id, {
      workload_spec: JSON.stringify(dep),
      image: dep.spec.template.spec.containers[0].image,
      desired: dep.spec.replicas,
      resource_limits: JSON.stringify(dep.spec.template.spec.containers[0].resources || {}),
      reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
      status: dep.spec.paused ? 'paused' : 'pending',
    });
    return { deployment: dep, status, revision };
  }

  async pause(id, projectId) {
    const row = await this.getById(id, projectId);
    const dep = deploymentFromTaskRow(row);
    dep.spec.paused = true;
    const snap = parseJson(row.reconcile_snapshot, {});
    const status = { ...(snap.status || emptyStatus()), rolloutState: 'Paused' };
    await this.Task.update(id, {
      workload_spec: JSON.stringify(dep),
      reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
      status: 'paused',
    });
    return { deployment: dep, status };
  }

  async resume(id, projectId) {
    const row = await this.getById(id, projectId);
    const dep = deploymentFromTaskRow(row);
    dep.spec.paused = false;
    const status = buildStatus({
      generation: (parseJson(row.reconcile_snapshot, {}).status || {}).revision || 0,
      revision: (parseJson(row.reconcile_snapshot, {}).status || {}).revision || 0,
      desired: dep.spec.replicas,
      ready: 0,
      conditions: setCondition([], CONDITIONS.Progressing, true, 'Resumed', 'Rollout resumed'),
      rolloutState: 'Progressing',
      rolloutStartedAt: new Date(this.clock()).toISOString(),
    });
    await this.Task.update(id, {
      workload_spec: JSON.stringify(dep),
      reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
      status: 'pending',
    });
    return { deployment: dep, status };
  }

  async rollback(id, projectId, toRevision) {
    const list = this.listRevisions(projectId, id);
    const target = list.find((d) => Number(d.metadata?.revision) === Number(toRevision))
      || list[list.length - 2];
    if (!target) {
      const e = new Error('no revision to roll back to');
      e.status = 400;
      throw e;
    }
    return this.apply(id, projectId, {
      replicas: target.spec.replicas,
      strategy: target.spec.strategy,
      progressDeadlineSeconds: target.spec.progressDeadlineSeconds,
      template: {
        name: target.metadata.name,
        image: target.spec.template.spec.containers[0].image,
        resources: target.spec.template.spec.containers[0].resources,
        probes: target.spec.template.spec.containers[0].probes,
      },
    });
  }

  /**
   * One reconcile pass: plan + optional apply via taskService; abort on deadline.
   */
  async reconcile(id, projectId, { forceFailReady = false } = {}) {
    const row = await this.getById(id, projectId);
    const dep = deploymentFromTaskRow(row);
    const snap = parseJson(row.reconcile_snapshot, {});
    let status = snap.status || emptyStatus();

    if (shouldAbortRollout(status, dep.spec, this.clock()) || forceFailReady) {
      status = {
        ...status,
        rolloutState: 'Aborted',
        conditions: setCondition(
          setCondition(status.conditions, CONDITIONS.Progressing, false, 'ProgressDeadlineExceeded', 'rollout aborted'),
          CONDITIONS.ReplicaFailure,
          true,
          'ProgressDeadlineExceeded',
          'failed to reach readyReplicas before deadline',
        ),
      };
      await this.Task.update(id, {
        reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
        status: 'failed',
      });
      return {
        aborted: true,
        deployment: dep,
        status,
        plan: planDeploymentRollout(dep, dep, { failedReady: true }),
      };
    }

    if (dep.spec.paused) {
      status = { ...status, rolloutState: 'Paused' };
      await this.Task.update(id, {
        reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
      });
      return { aborted: false, paused: true, deployment: dep, status, plan: { steps: [] } };
    }

    const plan = planDeploymentRollout(dep, dep);
    const results = [];
    const skipDocker = process.env.SKIP_DOCKER === '1' || process.env.COMPUTE_E2E_DOCKER !== '1';

    for (const step of plan.steps) {
      if (step.op === 'replace_image' && !skipDocker) {
        results.push({
          step,
          task: await this.taskService.replaceImage(id, projectId, step.image, {}),
        });
      } else if (step.op === 'scale' && !skipDocker) {
        results.push({
          step,
          task: await this.taskService.scaleTask(id, projectId, step.desired, {}),
        });
      } else {
        results.push({ step, skipped: skipDocker || step.op === 'reconcile_record' || step.op === 'rolling_wave' });
      }
    }

    const ready = skipDocker ? dep.spec.replicas : Number(row.desired || 0);
    status = buildStatus({
      generation: status.revision || 1,
      revision: status.revision || 1,
      desired: dep.spec.replicas,
      ready,
      updated: ready,
      available: ready,
      conditions: setCondition(
        setCondition([], CONDITIONS.Progressing, ready < dep.spec.replicas, 'ReplicaSetUpdated', 'reconcile pass'),
        CONDITIONS.Available,
        ready >= dep.spec.replicas && dep.spec.replicas > 0,
        ready >= dep.spec.replicas ? 'MinimumReplicasAvailable' : 'MinimumReplicasUnavailable',
        '',
      ),
      rolloutState: ready >= dep.spec.replicas ? 'Complete' : 'Progressing',
      rolloutStartedAt: status.rolloutStartedAt || new Date(this.clock()).toISOString(),
    });

    await this.Task.update(id, {
      reconcile_snapshot: JSON.stringify({ kind: 'Deployment', status }),
      status: status.rolloutState === 'Complete' ? 'running' : 'pending',
      desired: dep.spec.replicas,
    });

    return { aborted: false, deployment: dep, status, plan, results };
  }

  async reconcileProject(projectId) {
    this.assertProjectId(projectId);
    const rows = await this.Task.findAll({ where: { project_id: projectId } });
    const out = [];
    for (const row of rows) {
      out.push(await this.reconcile(row.id, projectId));
    }
    return out;
  }

  startLoop(projectId, intervalMs = 5000) {
    this.stopLoop(projectId);
    const handle = setInterval(() => {
      this.reconcileProject(projectId).catch(() => {});
    }, intervalMs);
    this._loops.set(projectId, handle);
    return handle;
  }

  stopLoop(projectId) {
    const h = this._loops.get(projectId);
    if (h) {
      clearInterval(h);
      this._loops.delete(projectId);
    }
  }
}

module.exports = { DeploymentController };

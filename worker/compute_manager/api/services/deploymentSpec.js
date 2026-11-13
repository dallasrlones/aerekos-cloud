'use strict';

/**
 * aerekos Compute — Deployment resource model (our Kubernetes).
 * Mapping: Project≈Namespace, Deployment, ReplicaSet revision, Pod≈container instance.
 */

const { normalizeWorkload, parseJson } = require('./workloadSpec');

const CONDITIONS = Object.freeze({
  Progressing: 'Progressing',
  Available: 'Available',
  ReplicaFailure: 'ReplicaFailure',
});

function normalizeStrategy(raw = {}) {
  const type = String(raw.type || 'RollingUpdate');
  if (type === 'Recreate') {
    return { type: 'Recreate' };
  }
  const ru = raw.rollingUpdate || raw;
  return {
    type: 'RollingUpdate',
    rollingUpdate: {
      maxUnavailable: Math.max(0, Number(ru.maxUnavailable ?? 0)),
      maxSurge: Math.max(0, Number(ru.maxSurge ?? 1)),
    },
  };
}

/**
 * @returns {object} Deployment-shaped desired spec
 */
function normalizeDeployment(body = {}, fallbacks = {}) {
  const wl = normalizeWorkload(body.template || body, fallbacks);
  const replicas = body.replicas != null ? Math.floor(Number(body.replicas)) : wl.replicas;
  if (Number.isNaN(replicas) || replicas < 0) {
    const e = new Error('deployment.replicas must be an integer >= 0');
    e.status = 400;
    throw e;
  }
  const strategy = normalizeStrategy(body.strategy || {});
  const progressDeadlineSeconds = Math.max(
    30,
    Number(body.progressDeadlineSeconds ?? 600),
  );
  const paused = Boolean(body.paused);
  const selector = body.selector && typeof body.selector === 'object'
    ? body.selector
    : { matchLabels: { app: wl.name || fallbacks.name || 'app' } };
  return {
    apiVersion: 'compute.aerekos/v1',
    kind: 'Deployment',
    metadata: {
      name: wl.name || fallbacks.name || 'unnamed',
      ...(body.metadata && typeof body.metadata === 'object' ? body.metadata : {}),
    },
    spec: {
      replicas,
      selector,
      strategy,
      progressDeadlineSeconds,
      paused,
      template: {
        metadata: { labels: selector.matchLabels || { app: wl.name } },
        spec: {
          containers: [
            {
              name: wl.name || 'main',
              image: wl.image,
              resources: wl.resources || {},
              probes: wl.probes || {},
            },
          ],
        },
      },
    },
  };
}

function deploymentFromTaskRow(row) {
  const stored = parseJson(row.workload_spec, null);
  if (stored && stored.kind === 'Deployment' && stored.spec) {
    return stored;
  }
  const wl = stored && stored.image
    ? stored
    : {
      name: row.name,
      image: row.image,
      replicas: row.desired == null ? 1 : Number(row.desired),
      resources: parseJson(row.resource_limits, {}),
    };
  return normalizeDeployment(wl, { name: row.name, image: row.image });
}

function emptyStatus() {
  return {
    observedGeneration: 0,
    replicas: 0,
    updatedReplicas: 0,
    readyReplicas: 0,
    availableReplicas: 0,
    unavailableReplicas: 0,
    conditions: [],
    revision: 0,
    rolloutState: 'Idle',
  };
}

function setCondition(conditions, type, status, reason, message) {
  const list = Array.isArray(conditions) ? [...conditions] : [];
  const idx = list.findIndex((c) => c.type === type);
  const entry = {
    type,
    status: status ? 'True' : 'False',
    reason: reason || '',
    message: message || '',
    lastTransitionTime: new Date().toISOString(),
  };
  if (idx >= 0) list[idx] = entry;
  else list.push(entry);
  return list;
}

/**
 * Plan rolling update steps with surge / unavailable caps.
 */
function planDeploymentRollout(current, next, { failedReady = false } = {}) {
  const strategy = next.spec.strategy || normalizeStrategy({});
  const desired = next.spec.replicas;
  const image = next.spec.template.spec.containers[0].image;
  const steps = [];

  if (next.spec.paused) {
    return { aborted: false, paused: true, steps: [], reason: 'paused' };
  }

  if (strategy.type === 'Recreate') {
    steps.push({ op: 'scale', desired: 0, phase: 'drain' });
    steps.push({ op: 'replace_image', image });
    steps.push({ op: 'scale', desired, phase: 'bring_up' });
  } else {
    const maxSurge = strategy.rollingUpdate.maxSurge;
    const maxUnavailable = strategy.rollingUpdate.maxUnavailable;
    steps.push({
      op: 'rolling_wave',
      image,
      desired,
      maxSurge,
      maxUnavailable,
    });
    if (String(current?.spec?.template?.spec?.containers?.[0]?.image) !== String(image)) {
      steps.push({ op: 'replace_image', image, surge: maxSurge });
    }
    steps.push({ op: 'scale', desired });
  }

  steps.push({ op: 'reconcile_record' });

  if (failedReady) {
    return {
      aborted: true,
      paused: false,
      steps: steps.slice(0, 1),
      reason: 'ProgressDeadlineExceeded',
      abort: true,
    };
  }

  return { aborted: false, paused: false, steps, reason: 'Progressing' };
}

/**
 * Evaluate progress deadline: if not ready past deadline → abort.
 */
function shouldAbortRollout(status, spec, nowMs = Date.now()) {
  if (!status || !status.rolloutStartedAt) return false;
  if (status.rolloutState === 'Paused' || spec.paused) return false;
  const ready = Number(status.readyReplicas || 0);
  const want = Number(spec.replicas || 0);
  if (ready >= want && want > 0) return false;
  const started = Date.parse(status.rolloutStartedAt);
  if (Number.isNaN(started)) return false;
  const deadline = Number(spec.progressDeadlineSeconds || 600) * 1000;
  return nowMs - started > deadline;
}

function buildStatus({ generation, revision, desired, ready, updated, available, conditions, rolloutState, rolloutStartedAt }) {
  return {
    observedGeneration: generation || 0,
    replicas: desired || 0,
    updatedReplicas: updated ?? ready ?? 0,
    readyReplicas: ready || 0,
    availableReplicas: available ?? ready ?? 0,
    unavailableReplicas: Math.max(0, (desired || 0) - (ready || 0)),
    conditions: conditions || [],
    revision: revision || 0,
    rolloutState: rolloutState || 'Idle',
    rolloutStartedAt: rolloutStartedAt || null,
  };
}

module.exports = {
  CONDITIONS,
  normalizeStrategy,
  normalizeDeployment,
  deploymentFromTaskRow,
  emptyStatus,
  setCondition,
  planDeploymentRollout,
  shouldAbortRollout,
  buildStatus,
  parseJson,
};

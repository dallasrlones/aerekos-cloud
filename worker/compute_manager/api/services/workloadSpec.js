'use strict';

function parseJson(raw, fallback) {
  try {
    if (raw == null || raw === '') return fallback;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return fallback;
  }
}

/**
 * Declarative workload document (ECS-style task desired state).
 * @typedef {{ name?: string, replicas: number, image: string, probes?: object, resources?: object }} WorkloadSpec
 */

const DEFAULT_PROBES = {
  liveness: { path: '/health', port: 8080, initialDelaySeconds: 10, periodSeconds: 30 },
  readiness: { path: '/ready', port: 8080, initialDelaySeconds: 5, periodSeconds: 10 },
};

function normalizeProbe(p, fallbackPath) {
  if (!p || typeof p !== 'object') return null;
  const out = { ...p };
  if (!out.path && fallbackPath) out.path = fallbackPath;
  return out;
}

function normalizeWorkload(body = {}, { name: fallbackName, image: fallbackImage } = {}) {
  const image = String(body.image || fallbackImage || '').trim();
  if (!image) {
    const e = new Error('workload.image is required');
    e.status = 400;
    throw e;
  }
  let replicas = body.replicas == null ? 1 : Number(body.replicas);
  if (Number.isNaN(replicas) || replicas < 0) {
    const e = new Error('workload.replicas must be an integer >= 0');
    e.status = 400;
    throw e;
  }
  replicas = Math.floor(replicas);
  const probesIn = body.probes && typeof body.probes === 'object' ? body.probes : {};
  const probes = {
    liveness: normalizeProbe(probesIn.liveness, DEFAULT_PROBES.liveness.path),
    readiness: normalizeProbe(probesIn.readiness, DEFAULT_PROBES.readiness.path),
  };
  const resources = { ...(body.resources && typeof body.resources === 'object' ? body.resources : {}) };
  const name = String(body.name || fallbackName || '').trim();
  return { name, replicas, image, probes, resources };
}

function workloadFromTaskRow(row) {
  const stored = parseJson(row.workload_spec, null);
  if (stored && stored.image) {
    return normalizeWorkload(stored, { name: row.name, image: row.image });
  }
  return normalizeWorkload(
    {
      name: row.name,
      image: row.image,
      replicas: row.desired == null ? 1 : Number(row.desired),
      resources: parseJson(row.resource_limits, {}),
    },
    { name: row.name, image: row.image },
  );
}

function actualFromTaskRow(row) {
  const replicaIds = parseJson(row.replica_ids, []);
  const extra = Array.isArray(replicaIds) ? replicaIds.filter(Boolean).length : 0;
  const runningPrimary = ['running', 'pending'].includes(String(row.status || '')) ? 1 : 0;
  const replicasRunning = runningPrimary + extra;
  return {
    name: row.name,
    replicas: replicasRunning,
    desired_replicas: row.desired == null ? 1 : Number(row.desired),
    image: row.image,
    status: row.status,
    resources: parseJson(row.resource_limits, {}),
    probes: {
      observed: false,
      status: 'stub',
    },
  };
}

function diffWorkload(desired, actual) {
  const fields = [];
  if (String(desired.image) !== String(actual.image)) fields.push('image');
  const want = Number(desired.replicas);
  const running = Number(actual.replicas);
  const declared = Number(actual.desired_replicas ?? actual.replicas);
  if (want !== running) fields.push('replicas');
  if (want !== declared) fields.push('desired_replicas');
  const dRes = JSON.stringify(desired.resources || {});
  const aRes = JSON.stringify(actual.resources || {});
  if (dRes !== aRes) fields.push('resources');
  return {
    inSync: fields.length === 0,
    fields,
  };
}

/**
 * Plan a rolling replace: scale out new revision, then retire old (stub steps).
 */
function planRollingReplace(currentImage, nextWorkload, { maxSurge = 1 } = {}) {
  const next = normalizeWorkload(nextWorkload, { image: nextWorkload?.image || currentImage });
  const steps = [];
  if (String(next.image) !== String(currentImage)) {
    steps.push({ op: 'replace_image', image: next.image, surge: maxSurge });
  }
  if (next.replicas != null) {
    steps.push({ op: 'scale', desired: next.replicas });
  }
  if (next.resources && Object.keys(next.resources).length) {
    steps.push({ op: 'patch_resources', resources: next.resources });
  }
  steps.push({ op: 'reconcile_record', note: 'record desired vs actual' });
  return { fromImage: currentImage, to: next, steps };
}

module.exports = {
  parseJson,
  normalizeWorkload,
  workloadFromTaskRow,
  actualFromTaskRow,
  diffWorkload,
  planRollingReplace,
  DEFAULT_PROBES,
};

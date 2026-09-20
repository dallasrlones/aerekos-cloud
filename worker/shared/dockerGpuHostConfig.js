'use strict';

/**
 * Apply GPU runtime + shm to a dockerode HostConfig.
 * Used by compute_manager DockerService and the worker ContainerHostService
 * so fleet-remote create on Orin can pass `runtime: nvidia`.
 */

function parseShmSize(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 0 ? Math.floor(value) : null;
  }
  const s = String(value).trim().toLowerCase();
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(b|k|kb|ki|m|mb|mi|g|gb|gi)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = m[2] || 'b';
  const mul = {
    b: 1,
    k: 1024,
    kb: 1024,
    ki: 1024,
    m: 1024 * 1024,
    mb: 1024 * 1024,
    mi: 1024 * 1024,
    g: 1024 * 1024 * 1024,
    gb: 1024 * 1024 * 1024,
    gi: 1024 * 1024 * 1024,
  };
  return Math.floor(n * (mul[unit] || 1));
}

function applyGpuHostConfig(hostConfig, p = {}) {
  const limits = p.resource_limits || p.resourceLimits || {};
  const runtime = String(p.runtime || limits.runtime || '').trim();
  if (runtime) hostConfig.Runtime = runtime;
  const shm = parseShmSize(p.shm_size ?? p.shmSize ?? limits.shm_size ?? limits.shmSize);
  if (shm != null) hostConfig.ShmSize = shm;
  return hostConfig;
}

function mergeRuntimeLimits(body = {}, resourceLimits = {}) {
  const out = { ...(resourceLimits && typeof resourceLimits === 'object' ? resourceLimits : {}) };
  if (body.runtime) out.runtime = String(body.runtime).trim();
  if (body.shm_size != null) out.shm_size = body.shm_size;
  else if (body.shmSize != null) out.shm_size = body.shmSize;
  return out;
}

function withRuntimeSpec(spec, resourceLimits) {
  const limits = resourceLimits && typeof resourceLimits === 'object' ? resourceLimits : {};
  const out = { ...spec, resource_limits: limits };
  const runtime = out.runtime || limits.runtime;
  const shm = out.shm_size != null ? out.shm_size : limits.shm_size;
  if (runtime) out.runtime = runtime;
  if (shm != null) out.shm_size = shm;
  return out;
}

module.exports = {
  parseShmSize,
  applyGpuHostConfig,
  mergeRuntimeLimits,
  withRuntimeSpec,
};

'use strict';

function parseCaps(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseResources(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw) || {};
  } catch {
    return {};
  }
}

/**
 * Infer device roles from capabilities, resources, and which managers run here.
 * GPU is how we infer `ai` — never a placement key named "gpu".
 */
function inferRoles(worker, instances = []) {
  const caps = parseCaps(worker.capabilities).map((c) => String(c).toLowerCase());
  const res = parseResources(worker.resources);
  const services = new Set((instances || []).map((i) => i.service || i.service_name));
  const roles = new Set();

  const hasGpu = !!(res.gpu || res.gpu_count || res.has_gpu || caps.includes('gpu') || caps.includes('ai'));
  if (hasGpu || services.has('ai_manager') || caps.includes('ai')) roles.add('ai');
  if (caps.includes('compute') || services.has('compute_manager') || res.docker) roles.add('compute');
  if (caps.includes('storage') || services.has('storage_manager') || Number(res.disk_gb) >= 500) roles.add('storage');
  if (caps.includes('data') || services.has('db_manager')) roles.add('data');
  if (caps.includes('edge') || services.has('tunnel_manager') || services.has('cdn_manager')) roles.add('edge');
  const host = String(worker.hostname || '').toLowerCase();
  if (caps.includes('control') || host.includes('prod') || host.includes('conductor')) roles.add('control');

  const override = parseCaps(worker.roles);
  if (override.length) return override.filter(Boolean);

  return [...roles];
}

module.exports = { parseCaps, parseResources, inferRoles };

'use strict';

/**
 * Sweep leftovers in a project then DELETE the project.
 * Safe to re-run. Does not assume DELETE /projects cascades.
 */

const { request, adminToken, env } = require('./lib/icarusLive');

async function tryDel(token, method, path, opts = {}) {
  try {
    await request(method, path, { token, ...opts });
  } catch {
    /* best-effort */
  }
}

async function listJson(token, path, query, key) {
  try {
    const r = await request('GET', path, { token, query });
    if (r.status !== 200) return [];
    const data = r.data || {};
    if (key && Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.jobs)) return data.jobs;
    return [];
  } catch {
    return [];
  }
}

async function sweepManager(token, projectId) {
  const q = { project_id: projectId };
  const intel = await listJson(token, '/api/services/ai_manager/api/v1/intelligence', q, 'items');
  for (const item of intel) {
    if (!String(item.name || '').startsWith('e2e') && !String(item.name || '').includes('e2e')) {
      /* still delete if we created the whole sandbox project */
    }
    await tryDel(token, 'DELETE', `/api/services/ai_manager/api/v1/intelligence/${item.id}`, { query: q });
  }
  const rag = await listJson(token, '/api/services/ai_manager/api/v1/rag', q, 'items');
  for (const item of rag) {
    await tryDel(token, 'DELETE', `/api/services/ai_manager/api/v1/rag/${item.id}`, { query: q });
  }
  const mem = await listJson(token, '/api/services/ai_manager/api/v1/memory/stores', q, 'items');
  for (const item of mem) {
    await tryDel(token, 'DELETE', `/api/services/ai_manager/api/v1/memory/stores/${item.id}`, { query: q });
  }
  const providers = await listJson(token, '/api/services/ai_manager/api/v1/providers', q, 'items');
  for (const item of providers) {
    if (String(item.name || '').includes('e2e')) {
      await tryDel(token, 'DELETE', `/api/services/ai_manager/api/v1/providers/${item.id}`, { query: q });
    }
  }
  const tasks = await listJson(token, '/api/services/compute_manager/api/v1/tasks', q, 'tasks');
  for (const item of tasks) {
    if (String(item.name || '').includes('e2e')) {
      await tryDel(token, 'DELETE', `/api/services/compute_manager/api/v1/tasks/${item.id}`, { query: q });
    }
  }
  const wanted = await listJson(token, '/api/services/registry_manager/api/v1/wanted', q, 'items');
  for (const item of wanted) {
    await tryDel(token, 'DELETE', `/api/services/registry_manager/api/v1/wanted/${item.id}`, { query: q });
  }
  const bals = await listJson(token, '/api/services/balancer_manager/api/v1/targets', q, 'items');
  for (const item of bals) {
    if (String(item.name || '').includes('e2e') || String(item.name || '').startsWith('intel-e2e')) {
      await tryDel(token, 'DELETE', `/api/services/balancer_manager/api/v1/targets/${item.id}`, { query: q });
    }
  }
  const hosts = await listJson(token, '/api/services/domain_manager/api/v1/dns/hostnames', q, 'hostnames');
  for (const item of hosts) {
    if (String(item.hostname || '').includes('e2e')) {
      await tryDel(token, 'DELETE', `/api/services/domain_manager/api/v1/dns/hostnames/${item.id}`, { query: q });
    }
  }
  const pipes = await listJson(token, '/api/services/cicd_manager/api/v1/pipelines', q, 'items');
  for (const item of pipes) {
    if (String(item.name || '').includes('e2e')) {
      await tryDel(token, 'DELETE', `/api/services/cicd_manager/api/v1/pipelines/${item.id}`, { query: q });
    }
  }
  await tryDel(token, 'DELETE', '/api/services/ai_manager/api/v1/intelligence/usage', { query: q });
  const nets = await listJson(token, '/api/services/network_manager/api/v1/networks', q, 'networks');
  for (const item of nets) {
    await tryDel(token, 'DELETE', `/api/services/network_manager/api/v1/networks/${item.id}`, { query: q });
  }
  const secrets = await listJson(token, '/api/services/secrets_manager/api/v1/secrets', q, 'secrets');
  for (const item of secrets) {
    if (String(item.name || '').includes('e2e')) {
      await tryDel(token, 'DELETE', `/api/services/secrets_manager/api/v1/secrets/${item.id}`, { query: q });
    }
  }
  const creds = await listJson(token, '/api/services/auth_manager/api/v1/credentials', q, 'credentials');
  for (const item of creds) {
    await tryDel(token, 'DELETE', `/api/services/auth_manager/api/v1/credentials/${item.id}`, { query: q });
  }
  const jobs = await listJson(token, '/api/jobs', q, 'jobs');
  for (const item of jobs) {
    await tryDel(token, 'DELETE', `/api/jobs/${item.id}`);
  }
  const databases = await listJson(token, '/api/services/db_manager/api/databases', q, 'databases');
  for (const item of databases) {
    const name = item.name || item;
    if (typeof name === 'string' && (name.includes('blogpg') || name.startsWith('e2e'))) {
      await tryDel(token, 'DELETE', `/api/services/db_manager/api/databases/${encodeURIComponent(name)}`, { query: q });
    }
  }
}

async function cleanupProject({ token, projectId, created } = {}) {
  const t = token || await adminToken();
  let pid = projectId;
  if (!pid && created) {
    const proj = created.find((c) => c.kind === 'project');
    pid = proj?.id;
  }
  if (pid) {
    await sweepManager(t, pid);
    await tryDel(t, 'DELETE', `/api/projects/${pid}`);
  }
}

async function sweepNamedProjects() {
  const token = await adminToken();
  const r = await request('GET', '/api/projects', { token });
  const projects = r.data?.projects || r.data || [];
  const list = Array.isArray(projects) ? projects : [];
  for (const p of list) {
    if (String(p.name || '').startsWith('e2e-platform-')) {
      console.log(`sweep ${p.name} ${p.id}`);
      await cleanupProject({ token, projectId: p.id });
    }
  }
}

async function main() {
  const pid = env('E2E_PROJECT_ID');
  if (pid) {
    await cleanupProject({ projectId: pid });
    console.log(`cleaned project ${pid}`);
    return;
  }
  await sweepNamedProjects();
  console.log('swept e2e-platform-* projects');
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

module.exports = { cleanupProject, sweepManager, sweepNamedProjects };

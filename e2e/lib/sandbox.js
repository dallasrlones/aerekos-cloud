'use strict';

const { request, adminToken, assert, env } = require('./icarusLive');
const { assertNotProdProject } = require('./prodGuard');

function parseCaps(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

async function describeFleet(token) {
  const w = await request('GET', '/api/workers', { token });
  const workers = w.data?.workers || w.data || [];
  const list = Array.isArray(workers) ? workers : [];
  const roles = new Set();
  const arches = new Set();
  for (const worker of list) {
    for (const r of worker.roles || []) roles.add(r);
    for (const c of parseCaps(worker.capabilities)) {
      if (c === 'gpu' || c === 'ai') roles.add('ai');
      if (c === 'compute') roles.add('compute');
    }
    if (worker.resources?.arch) arches.add(worker.resources.arch);
  }
  return {
    workers: list,
    workerCount: list.length,
    roles,
    arches,
    hasAi: roles.has('ai') || list.some((x) => parseCaps(x.capabilities).includes('gpu')),
  };
}

class Sandbox {
  constructor({ wave } = {}) {
    this.wave = wave || 'generic';
    this.runId = Date.now().toString(36);
    this.name = `e2e-platform-${this.wave}-${this.runId}`;
    this.projectId = null;
    this.token = null;
    this.fleet = null;
    this.created = [];
    this.skips = [];
  }

  track(entry) {
    this.created.push(entry);
    return entry;
  }

  skip(reason) {
    this.skips.push(reason);
    console.log(`  skip  ${reason}`);
  }

  async setup() {
    this.token = await adminToken();
    this.fleet = await describeFleet(this.token);
    const created = await request('POST', '/api/projects', {
      token: this.token,
      body: { name: this.name, description: `e2e ${this.wave}` },
    });
    assert(created.status === 201 || created.status === 200, `create project HTTP ${created.status}`);
    this.projectId = created.data?.project?.id || created.data?.id;
    assert(this.projectId, 'sandbox project id missing');
    assertNotProdProject(this.projectId);
    this.track({ kind: 'project', id: this.projectId });
    return this;
  }

  async cleanup() {
    const { cleanupProject } = require('../cleanup-project');
    await cleanupProject({
      token: this.token,
      projectId: this.projectId,
      created: this.created,
    });
  }
}

async function withSandbox(wave, fn) {
  const box = new Sandbox({ wave });
  try {
    await box.setup();
    await fn(box);
  } finally {
    try {
      await box.cleanup();
    } catch (err) {
      console.error(`  cleanup error: ${err.message}`);
    }
  }
  if (box.skips.length) {
    console.log(`  skipped: ${box.skips.join('; ')}`);
  }
  return box;
}

module.exports = { Sandbox, withSandbox, describeFleet };

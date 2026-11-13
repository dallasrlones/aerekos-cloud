'use strict';

/**
 * Live view of services attached to a project (from stack + runtime probes).
 */

async function snapshot(projectId) {
  const nodes = [];
  const edges = [];
  let stack = null;
  try {
    const { proxy } = require('../../../shared/conductorProxy');
    const res = await proxy('GET', `/api/projects/${encodeURIComponent(projectId)}/stack`, { timeout: 15000 });
    stack = res.data?.stack || res.data || null;
  } catch (e) {
    return {
      ok: false,
      error: e.message,
      nodes: [],
      edges: [],
      project_id: projectId,
    };
  }

  const add = (id, kind, label, meta = {}) => {
    nodes.push({
      id, kind, label, meta, health: meta.health || 'unknown',
    });
  };

  add(`project:${projectId}`, 'project', 'Project', { health: 'up' });

  for (const w of stack?.wanted || []) {
    add(`wanted:${w}`, 'manager', w, { health: 'configured' });
    edges.push({ from: `project:${projectId}`, to: `wanted:${w}`, rel: 'wants' });
  }
  for (const d of stack?.data_apis || []) {
    const id = `data_api:${d.name || d.id || 'api'}`;
    add(id, 'data_api', d.name || 'Data API', { engine: d.engine, health: 'configured' });
    edges.push({ from: `project:${projectId}`, to: id, rel: 'data_api' });
  }
  for (const r of stack?.routes || []) {
    const id = `route:${r.name || r.public_path || nodes.length}`;
    add(id, 'route', r.public_path || r.name || 'route', { method: r.method });
    edges.push({ from: `project:${projectId}`, to: id, rel: 'route' });
  }
  for (const f of stack?.functions || []) {
    const id = `fn:${f.name || nodes.length}`;
    add(id, 'function', f.name || 'function', {});
    edges.push({ from: `project:${projectId}`, to: id, rel: 'function' });
  }
  for (const q of stack?.queues || []) {
    const id = `queue:${q.name || nodes.length}`;
    add(id, 'queue', q.name || 'queue', { engine: q.engine });
    edges.push({ from: `project:${projectId}`, to: id, rel: 'queue' });
  }
  for (const t of stack?.tunnels || []) {
    const id = `tunnel:${t.name || t.hostname || nodes.length}`;
    add(id, 'tunnel', t.hostname || t.name || 'tunnel', { health: t.hostname ? 'configured' : 'unknown' });
    edges.push({ from: `project:${projectId}`, to: id, rel: 'tunnel' });
  }
  for (const c of stack?.compute || []) {
    const id = `compute:${c.name || nodes.length}`;
    add(id, 'compute', c.name || 'compute', {});
    edges.push({ from: `project:${projectId}`, to: id, rel: 'compute' });
  }

  // Best-effort health probes for wanted managers
  for (const n of nodes.filter((x) => x.kind === 'manager')) {
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      const res = await proxy('GET', `/api/services/${encodeURIComponent(n.label)}/health`, { timeout: 4000 });
      n.health = (res.status || 200) < 400 ? 'up' : 'down';
    } catch {
      n.health = 'unknown';
    }
  }

  return {
    ok: true,
    project_id: projectId,
    nodes,
    edges,
    stack_kind: stack?.kind || null,
  };
}

const ProjectServicesMap = { snapshot };

module.exports = { ProjectServicesMap, snapshot };

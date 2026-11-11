/**
 * Layered DAG layout from BEFORE edges. PARALLEL siblings share a layer.
 */

export const STATUS_COLOR = {
  pending: '#8a8a8a',
  ready: '#7fc4d8',
  running: '#d4af37',
  blocked: '#c45c26',
  done: '#5a8f5a',
  failed: '#c23b22',
  cancelled: '#8a8a8a',
  invalidated: '#6b4c7a',
};

export function layoutPlanGraph(subgraph = {}) {
  const tasks = subgraph.tasks || [];
  const edges = subgraph.edges || [];
  if (!tasks.length) return { nodes: [], edges: [], width: 320, height: 120 };

  const byId = new Map(tasks.map((t) => [t.id, t]));
  const before = edges.filter((e) => e.type === 'BEFORE');
  const preds = new Map();
  const succs = new Map();
  for (const t of tasks) {
    preds.set(t.id, new Set());
    succs.set(t.id, new Set());
  }
  for (const e of before) {
    if (!byId.has(e.from) || !byId.has(e.to)) continue;
    preds.get(e.to).add(e.from);
    succs.get(e.from).add(e.to);
  }

  const layerOf = new Map();
  const queue = tasks.filter((t) => (preds.get(t.id) || new Set()).size === 0).map((t) => t.id);
  queue.forEach((id) => layerOf.set(id, 0));
  const seen = new Set(queue);
  while (queue.length) {
    const id = queue.shift();
    const L = layerOf.get(id) || 0;
    for (const s of succs.get(id) || []) {
      const next = Math.max(layerOf.get(s) || 0, L + 1);
      layerOf.set(s, next);
      if (!seen.has(s)) {
        seen.add(s);
        queue.push(s);
      }
    }
  }
  tasks.forEach((t) => {
    if (!layerOf.has(t.id)) layerOf.set(t.id, 0);
  });

  const layers = new Map();
  for (const t of tasks) {
    const L = layerOf.get(t.id) || 0;
    if (!layers.has(L)) layers.set(L, []);
    layers.get(L).push(t);
  }

  const colW = 160;
  const rowH = 56;
  const pad = 24;
  const nodes = [];
  const maxLayer = Math.max(...[...layerOf.values()], 0);
  let maxRows = 1;
  for (let L = 0; L <= maxLayer; L += 1) {
    const row = layers.get(L) || [];
    maxRows = Math.max(maxRows, row.length);
    row.forEach((t, i) => {
      nodes.push({
        ...t,
        x: pad + L * colW,
        y: pad + i * rowH,
        color: STATUS_COLOR[t.status] || STATUS_COLOR.pending,
      });
    });
  }
  const pos = new Map(nodes.map((n) => [n.id, n]));
  const drawnEdges = edges
    .filter((e) => ['BEFORE', 'PARALLEL', 'MUTEX', 'INVALIDATES'].includes(e.type))
    .map((e) => {
      const a = pos.get(e.from);
      const b = pos.get(e.to);
      if (!a || !b) return null;
      return {
        ...e,
        x1: a.x + 120,
        y1: a.y + 18,
        x2: b.x,
        y2: b.y + 18,
      };
    })
    .filter(Boolean);

  return {
    nodes,
    edges: drawnEdges,
    width: pad * 2 + (maxLayer + 1) * colW,
    height: pad * 2 + maxRows * rowH,
  };
}

export function statusCounts(tasks = []) {
  const c = {
    running: 0, ready: 0, pending: 0, done: 0, failed: 0, blocked: 0, other: 0,
  };
  for (const t of tasks) {
    if (c[t.status] != null) c[t.status] += 1;
    else c.other += 1;
  }
  return c;
}

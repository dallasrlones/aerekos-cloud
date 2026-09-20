'use strict';

const DONE = new Set(['done', 'succeeded', 'completed', 'cancelled']);
const ACTIVE = new Set(['running', 'waiting_ask', 'queued', 'accepted', 'asking', 'proposed', 'drafting']);

function payloadOf(row) {
  try {
    return typeof row?.payload === 'string' ? JSON.parse(row.payload || '{}') : (row?.payload || {});
  } catch {
    return {};
  }
}

function descendants(work, id) {
  const kids = (work || []).filter((w) => w.parent_id === id);
  return kids.concat(kids.flatMap((k) => descendants(work, k.id)));
}

function taskNodes(item, work) {
  if (!item) return [];
  const tree = descendants(work, item.id);
  if (item.kind === 'goal') return tree.filter((w) => w.kind === 'task');
  return [item, ...tree.filter((w) => w.kind === 'task' && w.id !== item.id)];
}

function planProgress(plan) {
  const steps = plan?.steps || [];
  const done = steps.filter((s) => DONE.has(s.status)).length;
  const current = steps.find((s) => s.status === 'running' || s.status === 'waiting_ask' || s.status === 'accepted')
    || steps.find((s) => s.status === 'queued' || !s.status);
  return {
    total: steps.length,
    done,
    pct: steps.length ? Math.round((done / steps.length) * 100) : 0,
    currentTitle: current?.title || '',
    currentId: current?.id || '',
    source: 'plan',
  };
}

function progressOf(item, work = [], plan) {
  const nodes = taskNodes(item, work);
  if (!nodes.length && plan?.steps?.length) return planProgress(plan);
  const done = nodes.filter((w) => DONE.has(w.status)).length;
  const running = nodes.find((w) => w.status === 'running')
    || nodes.find((w) => w.status === 'waiting_ask')
    || nodes.find((w) => w.status === 'accepted' || w.status === 'queued');
  return {
    total: nodes.length,
    done,
    pct: nodes.length ? Math.round((done / nodes.length) * 100) : 0,
    currentTitle: running?.title || '',
    currentId: running?.id || '',
    source: 'work',
  };
}

function currentWork(workers = [], work = []) {
  const order = ['running', 'waiting_ask', 'queued'];
  const worker = order.map((s) => (workers || []).find((x) => x.status === s)).find(Boolean);
  if (!worker) return null;
  const task = (work || []).find((t) => t.id === worker.work_item_id);
  return {
    worker,
    task,
    label: worker.objective || task?.title || worker.persona || 'working',
  };
}

function formatPct(p) {
  if (!p) return '0%';
  if (!p.total) return `${p.pct || 0}%`;
  return `${p.pct}% (${p.done}/${p.total})`;
}

function relatedPlan(item, plans = []) {
  const planId = payloadOf(item).plan_id;
  if (!planId) return null;
  return (plans || []).find((p) => p.id === planId) || null;
}

module.exports = {
  DONE,
  ACTIVE,
  payloadOf,
  descendants,
  taskNodes,
  planProgress,
  progressOf,
  currentWork,
  formatPct,
  relatedPlan,
};

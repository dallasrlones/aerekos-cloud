'use strict';

const { PROD_PROJECT_ID } = require('./layerContext');
const { MAX_PROACTIVE } = require('./AgentPlanService');

const SKIP_DIR = /(^|\/)(node_modules|data|\.git|dist|build|coverage)(\/|$)/i;
const KNOWN_MANAGERS = [
  'ai_manager', 'compute_manager', 'queue_manager', 'schedule_manager', 'key_manager',
  'storage_manager', 'db_manager', 'iam_manager', 'metrics_manager', 'search_manager',
  'backup_manager', 'cicd_manager',
];

function cheapScan({ files = [], catalogNames = KNOWN_MANAGERS, diffFiles = [] } = {}) {
  const list = (files || []).map((f) => String(f.path || f || '').replace(/\\/g, '/'))
    .filter((p) => p && !SKIP_DIR.test(p) && !/\.env/.test(p));
  const findings = [];
  for (const name of catalogNames) {
    if (findings.length >= 3) break;
    const hasE2e = list.some((p) => p.includes(name) && /e2e/.test(p));
    if (!hasE2e) {
      findings.push({
        title: `${name} is missing e2e`,
        path: `worker/${name}`,
        kind: 'test',
        step: `Add a focused e2e for ${name} (never prod UUID, never auth_manager rebuild, never vLLM)`,
      });
    }
  }
  const skipped = list.filter((p) => /\.skip\.(js|ts)$|describe\.skip|it\.skip/.test(p));
  if (skipped.length && findings.length < 3) {
    findings.push({
      title: 'Skipped tests in the tree',
      path: skipped[0],
      kind: 'test',
      step: `Unskip or replace ${skipped[0]}`,
    });
  }
  const secretish = [...list, ...diffFiles].filter((p) => /\.env|id_rsa|credentials\.json/.test(p));
  if (secretish.length) {
    return { findings: [], deny: 'secrets in scan — skip idle review' };
  }
  return { findings: findings.slice(0, 3), deny: '' };
}

function findingsToPlan(findings, origin = 'idle') {
  const f = (findings || [])[0];
  if (!f) return null;
  return {
    origin: f.title,
    origin_kind: origin,
    status: 'proposed',
    steps: [
      { id: 's1', title: f.step, kind: f.kind || 'code', status: 'queued', dod: 'small slice, never prod UUID' },
    ],
  };
}

function shouldSkipIdle({ gateway, workers = [], projectId } = {}) {
  if (projectId === PROD_PROJECT_ID) return 'prod';
  const snap = gateway?.snapshot?.() || gateway || {};
  const inflight = snap.in_flight || snap.inFlight || [];
  const queued = snap.queued || [];
  const busy = [...inflight, ...queued].some((j) => /user|manager|execute|plan|safety|reflect/.test(String(j.lane || '')));
  if (busy) return 'foreground';
  if ((workers || []).some((w) => ['running', 'queued', 'waiting_ask'].includes(w.status))) return 'claim';
  return '';
}

module.exports = {
  cheapScan,
  findingsToPlan,
  shouldSkipIdle,
  KNOWN_MANAGERS,
  MAX_PROACTIVE,
};

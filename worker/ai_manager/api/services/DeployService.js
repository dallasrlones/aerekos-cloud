'use strict';

const { fail } = require('./agentArn');

const ALLOWED = new Set(['frontend', 'conductor', 'ai_manager']);
const DENY_RE = [
  /deploy\.sh\s+full/i,
  /--remove-orphans/,
  /\bvllm\b/i,
  /auth_manager/,
  /ea370977-3aff-4c76-95a6-a0c50fd2bce7/,
];

const RECIPES = {
  frontend: {
    host: 'prod-mini',
    speak: 'Publishing the console frontend on prod-mini, then restart.',
    paths: ['conductor/app', 'conductor/public'],
    restart: ['docker', 'restart', 'aerekos-cloud-frontend'],
    health: 'http://127.0.0.1:8080/',
    cmd: ['docker', 'restart', 'aerekos-cloud-frontend'],
  },
  conductor: {
    host: 'prod-mini',
    speak: 'Publishing conductor on prod-mini. Not a full compose.',
    paths: ['conductor/api'],
    restart: ['docker', 'restart', 'aerekos-cloud-conductor'],
    health: 'http://127.0.0.1:3000/health',
    cmd: ['docker', 'restart', 'aerekos-cloud-conductor'],
  },
  ai_manager: {
    host: 'orin',
    speak: 'Rebuilding ai_manager on Orin. The brain restarts — I will resume after.',
    paths: ['worker/ai_manager/api'],
    restart: ['sh', '-lc', 'cd /home/aerekos/work/aerekos/aerekos-cloud/worker && docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps --build ai_manager'],
    health: 'http://127.0.0.1:3126/health',
    cmd: ['sh', '-lc', 'cd /home/aerekos/work/aerekos/aerekos-cloud/worker && docker compose -p aerekos-ai -f docker-compose.ai.yml up -d --no-deps --build ai_manager'],
  },
};

function denyReason(target, extra = '') {
  const blob = `${target} ${extra}`;
  for (const re of DENY_RE) {
    if (re.test(blob)) return `deploy denied: ${re}`;
  }
  if (!ALLOWED.has(String(target || ''))) return `unknown deploy target ${target}`;
  return null;
}

async function propose(target) {
  const t = String(target || '').trim();
  const denied = denyReason(t);
  if (denied) throw fail(403, denied);
  return { target: t, ...RECIPES[t], pending: true };
}

async function run(target, { exec, fetchImpl, rollback = false, checkpoint } = {}) {
  const t = String(target || '').trim();
  const denied = denyReason(t);
  if (denied) throw fail(403, denied);
  const recipe = RECIPES[t];
  if (typeof exec !== 'function') {
    return { ok: true, dry: true, target: t, recipe };
  }
  const steps = [];
  const ck = checkpoint || { sha: `ckpt-${Date.now().toString(36)}`, paths: recipe.paths };
  try {
    if (rollback && ck) {
      const restored = await exec({ ...recipe, cmd: recipe.restart, step: 'rollback', checkpoint: ck });
      steps.push({ step: 'rollback', restored });
      return { ok: true, dry: false, rolled_back: true, checkpoint: ck, steps, rsync: false, restart: true };
    }
    for (const p of recipe.paths || []) {
      const rsync = await exec({
        ...recipe,
        cmd: ['rsync', '-a', '--exclude', '.env', '--exclude', 'data', '--exclude', 'node_modules', p, p],
        step: 'rsync',
        path: p,
      });
      steps.push({ step: 'rsync', path: p, result: rsync });
    }
    const restarted = await exec({ ...recipe, cmd: recipe.restart || recipe.cmd, step: 'restart' });
    steps.push({ step: 'restart', result: restarted });
    const get = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (get && recipe.health) {
      const res = await get(recipe.health, { method: 'GET' }).catch(() => ({ ok: false, status: 0 }));
      const healthy = !!(res && (res.ok || res.status === 200));
      if (!healthy) {
        await exec({ ...recipe, cmd: recipe.restart, step: 'rollback', checkpoint: ck });
        return {
          ok: false, dry: false, rsync: true, restart: true, health: false, rolled_back: true, checkpoint: ck, steps,
        };
      }
      return { ok: true, dry: false, rsync: true, restart: true, health: true, checkpoint: ck, steps };
    }
    return { ok: true, dry: false, rsync: true, restart: true, checkpoint: ck, steps };
  } catch (e) {
    try { await exec({ ...recipe, cmd: recipe.restart, step: 'rollback', checkpoint: ck }); } catch { /* */ }
    return { ok: false, dry: false, error: e.message, checkpoint: ck, rolled_back: true, steps };
  }
}

module.exports = { ALLOWED, DENY_RE, RECIPES, denyReason, propose, run };

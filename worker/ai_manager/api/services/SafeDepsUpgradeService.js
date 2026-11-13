'use strict';

/**
 * Want #4 — safe dependency upgrades: detect → branch → bump → checks → PR → rolling apply / rollback.
 * ASK-gated mutations; never touches keeper trees or prod project.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { PROD_PROJECT_ID } = require('./layerContext');

const KEEPER_MARKERS = ['aerekos-tv', PROD_PROJECT_ID, 'ea370977'];
const DEFAULT_KEEPERS = KEEPER_MARKERS;

function isKeeperTarget({ projectId, tree } = {}) {
  if (projectId === PROD_PROJECT_ID) return { denied: true, reason: 'prod_project' };
  const t = String(tree || '');
  const hit = DEFAULT_KEEPERS.find((k) => t.includes(k));
  if (hit) return { denied: true, reason: `keeper:${hit}` };
  return { denied: false };
}

function resolveTree(root, tree) {
  const rel = String(tree || '.').replace(/^\/+/, '');
  const base = path.resolve(root || process.cwd());
  const target = path.resolve(base, rel);
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('tree escapes workspace');
  }
  return { rel, abs: target };
}

function readJsonFile(p) {
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Parse package-lock lockfileVersion 2/3 packages map for version hints. */
function outdatedFromLockfile(pkgJson, lockPath) {
  const lock = readJsonFile(lockPath);
  if (!lock?.packages) return [];
  const deps = { ...pkgJson.dependencies, ...pkgJson.devDependencies };
  const out = [];
  for (const [name, wanted] of Object.entries(deps || {})) {
    const key = name.startsWith('@') ? `node_modules/${name}` : `node_modules/${name}`;
    const locked = lock.packages[key]?.version;
    if (!locked) continue;
    const w = String(wanted).replace(/^[\^~]/, '');
    if (locked !== w && semverishBehind(locked, w)) {
      out.push({ name, current: locked, wanted, latest: locked, source: 'lockfile' });
    }
  }
  return out;
}

function semverishBehind(a, b) {
  const pa = String(a).split('.').map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) < (pb[i] || 0)) return true;
    if ((pa[i] || 0) > (pb[i] || 0)) return false;
  }
  return false;
}

function npmOutdatedJson(cwd, { exec = execFileSync } = {}) {
  try {
    const raw = exec('npm', ['outdated', '--json'], {
      cwd,
      encoding: 'utf8',
      timeout: 45000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(raw || '{}');
    return Object.entries(parsed).map(([name, row]) => ({
      name,
      current: row.current,
      wanted: row.wanted,
      latest: row.latest,
      source: 'npm_outdated',
    }));
  } catch (e) {
    const stdout = e.stdout || '';
    if (stdout.trim()) {
      try {
        const parsed = JSON.parse(stdout);
        return Object.entries(parsed).map(([name, row]) => ({
          name,
          current: row.current,
          wanted: row.wanted,
          latest: row.latest,
          source: 'npm_outdated',
        }));
      } catch { /* */ }
    }
    return null;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.tree — relative claim path
 * @param {string} [opts.ecosystem='npm']
 * @param {string} opts.workspaceRoot
 */
function detectOutdated(opts = {}, hooks = {}) {
  const ecosystem = String(opts.ecosystem || 'npm').toLowerCase();
  const keeper = isKeeperTarget({ projectId: opts.projectId, tree: opts.tree });
  if (keeper.denied) {
    return { ok: false, denied: true, reason: keeper.reason, outdated: [] };
  }
  if (ecosystem !== 'npm') {
    return { ok: false, error: `ecosystem ${ecosystem} not supported yet`, outdated: [] };
  }
  const { abs, rel } = resolveTree(opts.workspaceRoot, opts.tree);
  const pkgPath = path.join(abs, 'package.json');
  const pkgJson = readJsonFile(pkgPath);
  if (!pkgJson) {
    return { ok: false, error: 'package.json missing', tree: rel, outdated: [] };
  }

  let outdated = npmOutdatedJson(abs, hooks);
  if (outdated == null) {
    const lockPath = fs.existsSync(path.join(abs, 'package-lock.json'))
      ? path.join(abs, 'package-lock.json')
      : path.join(abs, 'npm-shrinkwrap.json');
    outdated = outdatedFromLockfile(pkgJson, lockPath);
  }
  return {
    ok: true,
    tree: rel,
    ecosystem,
    outdated: outdated || [],
    package_json: path.relative(opts.workspaceRoot || abs, pkgPath),
  };
}

function branchName(slug = 'upgrade') {
  const safe = String(slug).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 32) || 'upgrade';
  return `icarus/deps-${safe}-${Date.now().toString(36).slice(-5)}`;
}

function bumpPackageJson(pkgJson, bumps) {
  const next = JSON.parse(JSON.stringify(pkgJson));
  for (const b of bumps) {
    const sections = ['dependencies', 'devDependencies', 'optionalDependencies'];
    for (const sec of sections) {
      if (next[sec] && next[sec][b.name] != null) {
        const prefix = String(next[sec][b.name]).match(/^[\^~]/)?.[0] || '^';
        next[sec][b.name] = `${prefix}${b.latest || b.wanted}`;
      }
    }
  }
  return next;
}

function planUpgrade(opts = {}, hooks = {}) {
  const detected = detectOutdated(opts, hooks);
  if (!detected.ok) return { ...detected, dryRun: true, branch: null, bumps: [] };
  const bumps = (detected.outdated || []).slice(0, 20);
  const slug = bumps[0]?.name || 'deps';
  return {
    dryRun: true,
    ok: true,
    tree: detected.tree,
    ecosystem: detected.ecosystem,
    outdated: detected.outdated,
    bumps,
    branch: branchName(slug),
    auto_merge: false,
    steps: ['detect', 'branch', 'bump', 'run_checks', 'open_pr', 'rolling_apply', 'rollback_on_fail'],
  };
}

async function rollingApplyIfPresent(projectId, tree, hooks = {}) {
  const hasIac = typeof hooks.iacApply === 'function';
  const hasCicd = typeof hooks.cicdTrigger === 'function';
  if (!hasIac && !hasCicd) {
    return { ok: true, skipped: true, reason: 'no iac/cicd hooks' };
  }
  const out = { ok: true, applied: [] };
  if (hasIac) {
    const iac = await hooks.iacApply({ projectId, tree, rolling: true });
    out.applied.push({ kind: 'iac_apply', ...iac });
    if (iac?.ok === false) out.ok = false;
  }
  if (hasCicd) {
    const cicd = await hooks.cicdTrigger({ projectId, tree, channel: 'rolling' });
    out.applied.push({ kind: 'cicd', ...cicd });
    if (cicd?.ok === false) out.ok = false;
  }
  return out;
}

/**
 * Roll back package.json + lock snapshot written during upgrade.
 */
function rollbackFromCheckpoint(checkpoint = {}, hooks = {}) {
  const { packageJsonPath, packageJsonBefore, lockPath, lockBefore } = checkpoint;
  if (!packageJsonPath || packageJsonBefore == null) {
    return { ok: false, error: 'no checkpoint' };
  }
  if (hooks.writeFile) {
    hooks.writeFile(packageJsonPath, packageJsonBefore);
    if (lockPath && lockBefore != null) hooks.writeFile(lockPath, lockBefore);
  } else {
    fs.writeFileSync(packageJsonPath, packageJsonBefore, 'utf8');
    if (lockPath && lockBefore != null) fs.writeFileSync(lockPath, lockBefore, 'utf8');
  }
  return { ok: true, rolled_back: true, paths: [packageJsonPath, lockPath].filter(Boolean) };
}

/**
 * Full upgrade pipeline (dryRun = detect/plan only).
 * @param {object} ctx — { runTool, openPr, projectId, agentId, settings, approved }
 */
async function runUpgrade(opts = {}, ctx = {}) {
  const dryRun = Boolean(opts.dryRun);
  const keeper = isKeeperTarget({ projectId: ctx.projectId || opts.projectId, tree: opts.tree });
  if (keeper.denied) {
    return { ok: false, denied: true, reason: keeper.reason };
  }

  const plan = planUpgrade({
    tree: opts.tree,
    ecosystem: opts.ecosystem,
    workspaceRoot: ctx.workspaceRoot || opts.workspaceRoot,
    projectId: ctx.projectId,
  }, ctx.hooks);

  if (!plan.ok) return plan;
  if (dryRun) return plan;

  if (!ctx.approved) {
    return {
      ok: false,
      ask: true,
      reason: 'safe_deps_upgrade requires ASK approval',
      plan,
    };
  }

  const root = ctx.workspaceRoot || process.cwd();
  const { abs, rel } = resolveTree(root, opts.tree);
  const pkgPath = path.join(abs, 'package.json');
  const pkgBefore = fs.readFileSync(pkgPath, 'utf8');
  const lockPath = path.join(abs, 'package-lock.json');
  const lockBefore = fs.existsSync(lockPath) ? fs.readFileSync(lockPath, 'utf8') : null;
  const checkpoint = { packageJsonPath: pkgPath, packageJsonBefore: pkgBefore, lockPath, lockBefore };

  const branch = opts.branch || plan.branch;
  const runTool = ctx.runTool;
  if (!runTool) {
    return { ok: false, error: 'runTool required for apply' };
  }

  await runTool('git_checkout', { branch, create: branch, claim: rel });
  const pkgJson = JSON.parse(pkgBefore);
  const bumped = bumpPackageJson(pkgJson, plan.bumps);
  await runTool('file_write', {
    path: path.relative(root, pkgPath),
    content: `${JSON.stringify(bumped, null, 2)}\n`,
    claim: rel,
  });

  await runTool('git_commit', { claim: rel, message: `chore(deps): bump ${plan.bumps.map((b) => b.name).join(', ')}` });

  const checks = await runTool('run_checks', { claim: rel });
  const checksOk = checks?.passed !== false && checks?.ok !== false;
  if (!checksOk) {
    rollbackFromCheckpoint(checkpoint);
    await runTool('git_checkout', { branch: 'HEAD', claim: rel }).catch(() => {});
    return { ok: false, checks, rolled_back: true, branch };
  }

  let pr = null;
  if (ctx.openPr) {
    pr = await ctx.openPr({
      title: `chore(deps): ${plan.bumps.map((b) => b.name).slice(0, 5).join(', ')}`,
      summary: `Dependency bumps on ${rel}. Branch ${branch}. Never auto-merge.`,
      branch,
      files: [path.relative(root, pkgPath)],
      claim: rel,
    });
  }

  const rolling = await rollingApplyIfPresent(ctx.projectId, rel, ctx.hooks);

  return {
    ok: true,
    dryRun: false,
    branch,
    tree: rel,
    bumps: plan.bumps,
    checks,
    pr,
    rolling,
    auto_merge: false,
    checkpoint,
    rollback: () => rollbackFromCheckpoint(checkpoint, ctx.hooks),
  };
}

module.exports = {
  SafeDepsUpgradeService: {
    isKeeperTarget,
    detectOutdated,
    planUpgrade,
    branchName,
    bumpPackageJson,
    rollingApplyIfPresent,
    rollbackFromCheckpoint,
    runUpgrade,
  },
  KEEPER_MARKERS,
};

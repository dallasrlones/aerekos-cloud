'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { FLOW_SLOTS, LayaDecisionService } = require('../../api/services/LayaDecisionService');
const { SafeDepsUpgradeService: safeDeps, KEEPER_MARKERS } = require('../../api/services/SafeDepsUpgradeService');
const { PROD_PROJECT_ID } = require('../../api/services/layerContext');

describe('safe_deps_upgrade flow', () => {
  const laya = new LayaDecisionService();

  test('flow_pick and FLOW_SLOTS registration', async () => {
    expect(laya.packs().flow_pick.options).toContain('safe_deps_upgrade');
    expect(FLOW_SLOTS.safe_deps_upgrade.required).toContain('tree');
    expect(FLOW_SLOTS.safe_deps_upgrade.defaults.ecosystem).toBe('npm');
    const pick = await laya.predict(
      { text: 'upgrade outdated npm packages in the monorepo' },
      { flow_pick: {} },
    );
    expect(pick.answers.flow_pick.choice).toBe('safe_deps_upgrade');
  });

  test('intakeAsk for tree then ready', () => {
    const ask = laya.intakeAsk('safe_deps_upgrade', {});
    expect(ask.ready).toBe(false);
    expect(ask.field).toBe('tree');
    const ready = laya.intakeAsk('safe_deps_upgrade', { tree: 'worker/ai_manager', ecosystem: 'npm' });
    expect(ready.ready).toBe(true);
    expect(ready.summary).toMatch(/icarus\/deps/);
  });

  test('never touch keepers', () => {
    expect(KEEPER_MARKERS).toContain(PROD_PROJECT_ID);
    expect(safeDeps.isKeeperTarget({ projectId: PROD_PROJECT_ID, tree: 'foo' }).denied).toBe(true);
    expect(safeDeps.isKeeperTarget({ tree: 'aerekos-tv/app' }).denied).toBe(true);
    const plan = safeDeps.planUpgrade({
      tree: 'aerekos-tv',
      projectId: 'e2e-123',
      workspaceRoot: os.tmpdir(),
    });
    expect(plan.denied || plan.ok === false).toBe(true);
  });

  test('dry-run detect path without git mutation', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-dry-'));
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'dry-run-pkg',
      version: '1.0.0',
      dependencies: { leftpad: '^1.0.0' },
    }, null, 2));
    fs.writeFileSync(path.join(dir, 'package-lock.json'), JSON.stringify({
      name: 'dry-run-pkg',
      lockfileVersion: 2,
      packages: {
        '': { name: 'dry-run-pkg', version: '1.0.0' },
        'node_modules/leftpad': { version: '0.0.1' },
      },
    }));

    const plan = safeDeps.planUpgrade({
      tree: '.',
      ecosystem: 'npm',
      workspaceRoot: dir,
      projectId: 'e2e-safe-deps',
    });

    expect(plan.dryRun).toBe(true);
    expect(plan.ok).toBe(true);
    expect(plan.branch).toMatch(/^icarus\/deps-/);
    expect(plan.auto_merge).toBe(false);
    expect(Array.isArray(plan.outdated)).toBe(true);

    const touched = fs.readdirSync(dir);
    expect(touched).toEqual(expect.arrayContaining(['package.json', 'package-lock.json']));
    expect(touched).not.toContain('.git');
  });

  test('rollback helper restores package.json snapshot', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'deps-rb-'));
    const pkgPath = path.join(dir, 'package.json');
    const before = '{"name":"x","version":"1.0.0"}\n';
    const after = '{"name":"x","version":"9.9.9"}\n';
    fs.writeFileSync(pkgPath, after, 'utf8');
    const rolled = safeDeps.rollbackFromCheckpoint({
      packageJsonPath: pkgPath,
      packageJsonBefore: before,
    });
    expect(rolled.ok).toBe(true);
    expect(fs.readFileSync(pkgPath, 'utf8')).toBe(before);
  });
});

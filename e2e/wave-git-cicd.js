'use strict';

const { skipLive, assert, runNamed, request } = require('./lib/icarusLive');
const { withSandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function main() {
  console.log('Wave git/cicd e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }
  let ok = true;
  await withSandbox('git-cicd', async (box) => {
    assertNotProdProject(box.projectId);
    const { token, projectId: pid } = box;

    ok = await runNamed('create app repo + recordPush test pipeline', async () => {
      const repo = await request('POST', '/api/services/git_manager/api/v1/repos', {
        token,
        body: { project_id: pid, name: 'app' },
      });
      assert(repo.status === 201 || repo.status === 200, `repo HTTP ${repo.status}`);
      const id = repo.data?.repository?.id || repo.data?.item?.id;
      if (id) box.track({ kind: 'repo', id });
      const pipe = await request('POST', '/api/services/cicd_manager/api/v1/pipelines', {
        token,
        body: { project_id: pid, name: 'e2e-app', repo: 'app', steps_json: '["test"]' },
      });
      assert(pipe.status < 400, `pipeline HTTP ${pipe.status}`);
      const run = await request('POST', '/api/services/cicd_manager/api/v1/pipelines/run-for-repo', {
        token,
        body: { project_id: pid, repo: 'app', repo_name: 'app' },
      });
      assert(run.status < 500, `run-for-repo HTTP ${run.status}`);
      return String(run.status);
    }) && ok;

    ok = await runNamed('aerekos-cloud never apply-stack', async () => {
      await request('POST', '/api/services/cicd_manager/api/v1/pipelines', {
        token,
        body: { project_id: pid, name: 'e2e-cloud', repo: 'aerekos-cloud', steps_json: '["test"]' },
      });
      const run = await request('POST', '/api/services/cicd_manager/api/v1/pipelines/run-for-repo', {
        token,
        body: { project_id: pid, repo: 'aerekos-cloud', repo_name: 'aerekos-cloud' },
      });
      assert(run.status < 500, `cloud run HTTP ${run.status}`);
      const action = run.data?.action;
      assert(action !== 'apply-stack' && action !== 'fleet', `sandbox aerekos-cloud must not apply-stack or fleet, got ${action}`);
      return action || 'ok';
    }) && ok;

    ok = await runNamed('infra apply-stack does not crash without EDGE_BOOTSTRAP_HOSTNAME', async () => {
      await request('POST', '/api/services/cicd_manager/api/v1/pipelines', {
        token,
        body: { project_id: pid, name: 'e2e-infra', repo: 'infra', steps_json: '["apply-stack"]' },
      });
      const run = await request('POST', '/api/services/cicd_manager/api/v1/pipelines/run-for-repo', {
        token,
        body: { project_id: pid, repo: 'infra', repo_name: 'infra' },
        timeoutMs: 180000,
      });
      assert(run.status < 500, `infra run HTTP ${run.status}`);
      return String(run.status);
    }) && ok;
  });
  process.exit(ok ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });

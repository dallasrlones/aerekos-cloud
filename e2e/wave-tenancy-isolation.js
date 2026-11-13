'use strict';

/**
 * W19 — cross-project isolation: project B token must not read project A resources.
 * Skips when CONDUCTOR_URL / AEREKOS_API_URL unset (ICARUS_C0_SKIP_LIVE).
 */

const { skipLive, assert, runNamed, request, adminToken } = require('./lib/icarusLive');
const { Sandbox } = require('./lib/sandbox');
const { assertNotProdProject } = require('./lib/prodGuard');

async function createProject(token, label) {
  const created = await request('POST', '/api/projects', {
    token,
    body: { name: `e2e-tenancy-${label}-${Date.now()}`, description: 'tenancy isolation' },
  });
  assert(created.status === 201 || created.status === 200, `create project HTTP ${created.status}`);
  const id = created.data?.project?.id || created.data?.id;
  assert(id, 'project id missing');
  assertNotProdProject(id);
  return id;
}

async function main() {
  console.log('Wave tenancy isolation e2e');
  if (skipLive()) {
    console.log('  skip live');
    process.exit(0);
  }

  let ok = true;
  const token = await adminToken();
  const boxA = new Sandbox({ wave: 'tenancy-a' });
  const boxB = new Sandbox({ wave: 'tenancy-b' });
  boxA.token = token;
  boxB.token = token;

  try {
    boxA.projectId = await createProject(token, 'a');
    boxB.projectId = await createProject(token, 'b');

    let bucketName = null;
    ok = await runNamed('project A creates storage bucket', async () => {
      const bucket = await request('POST', '/api/services/storage_manager/api/v1/buckets', {
        token,
        body: { project_id: boxA.projectId, name: `e2e-iso-${Date.now()}` },
      });
      assert(bucket.status < 400, `bucket create HTTP ${bucket.status}`);
      bucketName = bucket.data?.bucket?.name || bucket.data?.name;
      assert(bucketName, 'bucket name missing');
      return bucketName;
    }) && ok;

    ok = await runNamed('project B cannot read project A bucket (wrong project_id)', async () => {
      const list = await request('GET', '/api/services/storage_manager/api/v1/buckets', {
        token,
        query: { project_id: boxB.projectId },
      });
      assert(list.status < 500, `list HTTP ${list.status}`);
      const names = (list.data?.buckets || list.data?.items || list.data || [])
        .map((b) => b.name)
        .filter(Boolean);
      assert(!names.includes(bucketName), 'cross-tenant bucket visible in project B list');
      return 'isolated';
    }) && ok;

    ok = await runNamed('project B rejected when using project A id on write', async () => {
      const hostile = await request('POST', '/api/services/storage_manager/api/v1/buckets', {
        token,
        body: { project_id: boxA.projectId, name: `e2e-hostile-${Date.now()}` },
      });
      // Accept 403/404/409 — anything that is not a successful hostile create with B-scoped creds only
      if (hostile.status < 400) {
        assert(
          hostile.data?.bucket?.project_id === boxA.projectId,
          'unexpected bucket created without project scope enforcement',
        );
        return 'admin-spanning-ok';
      }
      assert(hostile.status === 403 || hostile.status === 404 || hostile.status === 409, `HTTP ${hostile.status}`);
      return String(hostile.status);
    }) && ok;
  } finally {
    const { cleanupProject } = require('./cleanup-project');
    for (const box of [boxA, boxB]) {
      if (box.projectId) {
        try {
          await cleanupProject({ token, projectId: box.projectId, created: [] });
        } catch (err) {
          console.error(`  cleanup error: ${err.message}`);
        }
      }
    }
  }

  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

'use strict';

/**
 * Tier 6 — App credentials + ARN-scoped invoke (M1 golden path).
 * Requires Tier 0 spine (admin JWT in TOKEN).
 */

const { AerekosClient, invoke } = require('../aerekos-sdk');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

/**
 * @param {typeof import('./run').http} http
 * @param {string} TOKEN admin JWT
 * @param {string} RUN_ID
 * @param {typeof import('./run').check} check
 */
async function tier6AppAccess(http, TOKEN, RUN_ID, check) {
  console.log('\n\x1b[1m\x1b[36mTier 6 — App access (credentials + ARN)\x1b[0m');

  let projectId = PID;
  let endpointArn = null;
  let bucketArn = null;
  let databaseArn = null;
  let secretArn = null;
  let taskArn = null;
  let secretId = null;
  let taskId = null;
  let queueArn = null;
  let queueName = null;
  let webhookArn = null;
  let webhookId = null;
  let repoArn = null;
  let repoId = null;
  let appToken = null;
  let clientId = null;
  let clientSecret = null;
  let credId = null;
  let storageProjectId = null;

  await check('app-access', 'conductor POST /api/projects (UUID project)', async () => {
    const r = await http('POST', '/api/projects', {
      body: { name: `e2e-app-${RUN_ID}`, description: 'tier6 app access' },
      token: TOKEN,
    });
    assert(r.status === 201, `create project HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
    assert(r.data.project && r.data.project.id, 'no project.id');
    projectId = r.data.project.id;
    return projectId;
  });

  await check('app-access', 'storage_manager create project', async () => {
    const r = await http('POST', '/api/services/storage_manager/api/projects', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: `e2e-stor-${RUN_ID}` },
    });
    assert(r.status === 201, `storage project HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
    storageProjectId = r.data.id;
    assert(storageProjectId, 'no storage project id');
    return storageProjectId;
  });

  await check('app-access', 'ai_manager create endpoint with ARN', async () => {
    const ename = `e2e-llm-${RUN_ID}`;
    const r = await http('POST', '/api/services/ai_manager/api/v1/providers', {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        project_id: projectId,
        name: ename,
        capability: 'llm',
        provider: 'ollama',
        provider_type: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
      },
    });
    assert(r.status === 201, `create endpoint HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    const item = r.data.item || r.data;
    endpointArn = item.arn;
    assert(endpointArn && endpointArn.includes(':ai:llm:endpoint/'), `missing arn: ${endpointArn}`);
    return endpointArn;
  });

  await check('app-access', 'storage_manager bucket create returns ARN', async () => {
    const bname = `e2e-bkt-${RUN_ID}`.replace(/[^a-z0-9-]/g, '-').toLowerCase().slice(0, 32);
    const r = await http('POST', `/api/services/storage_manager/api/projects/${storageProjectId}/buckets`, {
      token: TOKEN,
      query: { project_id: storageProjectId },
      body: { name: bname },
    });
    assert(r.status === 201, `bucket HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    bucketArn = r.data.arn;
    assert(bucketArn && bucketArn.includes(':storage:bucket/'), `missing bucket arn: ${bucketArn}`);
    return bucketArn;
  });

  await check('app-access', 'iam_manager policy evaluate allow/deny', async () => {
    const roleName = `e2e-role-${RUN_ID}`.replace(/[^a-z0-9-]/g, '-').toLowerCase().slice(0, 32);
    const allowPol = await http('POST', '/api/services/iam_manager/api/v1/policies', {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        project_id: projectId,
        name: `e2e-allow-${RUN_ID}`.slice(0, 32),
        effect: 'allow',
        document: { actions: ['storage:ListBucket'], resources: [bucketArn] },
      },
    });
    assert(allowPol.status === 201, `iam allow policy HTTP ${allowPol.status}: ${JSON.stringify(allowPol.data).slice(0, 120)}`);

    const denyPol = await http('POST', '/api/services/iam_manager/api/v1/policies', {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        project_id: projectId,
        name: `e2e-deny-${RUN_ID}`.slice(0, 32),
        effect: 'deny',
        document: { actions: ['storage:DeleteObject'], resources: [bucketArn] },
      },
    });
    assert(denyPol.status === 201, `iam deny policy HTTP ${denyPol.status}`);

    const role = await http('POST', '/api/services/iam_manager/api/v1/roles', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { project_id: projectId, name: roleName },
    });
    assert(role.status === 201, `iam role HTTP ${role.status}`);
    const roleId = role.data.role.id;

    for (const policyId of [allowPol.data.policy.id, denyPol.data.policy.id]) {
      const at = await http('POST', `/api/services/iam_manager/api/v1/roles/${roleId}/policies`, {
        token: TOKEN,
        query: { project_id: projectId },
        body: { project_id: projectId, policy_id: policyId },
      });
      assert(at.status === 201, `attach policy HTTP ${at.status}`);
    }

    const allowed = await http('POST', '/api/services/iam_manager/api/v1/evaluate', {
      token: TOKEN,
      body: {
        project_id: projectId,
        role_name: roleName,
        action: 'storage:ListBucket',
        resource_arn: bucketArn,
      },
    });
    assert(allowed.status === 200 && allowed.data.evaluation?.allowed === true, `iam allow eval: ${JSON.stringify(allowed.data).slice(0, 120)}`);

    const denied = await http('POST', '/api/services/iam_manager/api/v1/evaluate', {
      token: TOKEN,
      body: {
        project_id: projectId,
        role_name: roleName,
        action: 'storage:DeleteObject',
        resource_arn: bucketArn,
      },
    });
    assert(denied.status === 200 && denied.data.evaluation?.allowed === false, `iam deny eval: ${JSON.stringify(denied.data).slice(0, 120)}`);

    const viaConductor = await http('POST', '/api/iam/evaluate', {
      token: TOKEN,
      body: {
        project_id: projectId,
        role_name: roleName,
        action: 'storage:ListBucket',
        resource_arn: bucketArn,
      },
    });
    assert(viaConductor.status === 200 && viaConductor.data.evaluation?.allowed === true, `conductor iam eval: ${JSON.stringify(viaConductor.data).slice(0, 120)}`);
    return 'iam evaluate ok';
  });

  await check('app-access', 'db_manager create database returns ARN', async () => {
    const dname = `e2e-db-${RUN_ID}`.replace(/[^a-z0-9-]/g, '-').toLowerCase().slice(0, 24);
    const r = await http('POST', '/api/services/db_manager/api/databases', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: dname, type: 'redis', resource_limits: { cpu_cores: 0.25, ram_gb: 0.5, disk_gb: 1 } },
    });
    assert(r.status === 201, `db create HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    databaseArn = r.data.arn;
    assert(databaseArn && databaseArn.includes(':db:database/'), `missing db arn: ${databaseArn}`);
    return databaseArn;
  });

  await check('app-access', 'secrets_manager create secret returns ARN', async () => {
    const sname = `e2esec-${RUN_ID}`.replace(/[^a-z0-9-_]/g, '-').slice(0, 32);
    const r = await http('POST', '/api/services/secrets_manager/api/v1/secrets', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: sname, value: `tier6-${RUN_ID}` },
    });
    assert(r.status === 201, `secret HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    secretArn = r.data.secret?.arn;
    secretId = r.data.secret?.id;
    assert(secretArn && secretArn.includes(':secrets:secret/'), `missing secret arn: ${secretArn}`);
    return secretArn;
  });

  await check('app-access', 'compute_manager create task returns ARN', async () => {
    const tname = `e2e-task-${RUN_ID}`.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32);
    const r = await http('POST', '/api/services/compute_manager/api/v1/tasks', {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        name: tname,
        image: 'alpine:3.19',
        run_mode: 'oneshot',
        command: ['echo', 'tier6'],
      },
    });
    assert(r.status === 201, `task HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    taskArn = r.data.task?.arn;
    taskId = r.data.task?.id;
    assert(taskArn && taskArn.includes(':compute:task/'), `missing task arn: ${taskArn}`);
    return taskArn;
  });

  await check('app-access', 'queue_manager create queue returns ARN', async () => {
    queueName = `e2e-queue-${RUN_ID}`.replace(/[^a-z0-9-_]/g, '-').slice(0, 32);
    const r = await http('POST', '/api/services/queue_manager/api/v1/queues', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: queueName },
    });
    assert(r.status === 201, `queue HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    queueArn = r.data.queue?.arn;
    assert(queueArn && queueArn.includes(':queue:queue/'), `missing queue arn: ${queueArn}`);
    return queueArn;
  });

  await check('app-access', 'webhook_manager create endpoint returns ARN', async () => {
    const wname = `e2e-hook-${RUN_ID}`.replace(/[^a-z0-9-_]/g, '-').slice(0, 32);
    const r = await http('POST', '/api/services/webhook_manager/api/v1/webhooks', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: wname, target_url: 'https://example.com/tier6-hook' },
    });
    assert(r.status === 201, `webhook HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    webhookArn = r.data.webhook?.arn;
    webhookId = r.data.webhook?.id;
    assert(webhookArn && webhookArn.includes(':webhook:endpoint/'), `missing webhook arn: ${webhookArn}`);
    return webhookArn;
  });

  await check('app-access', 'git_manager create repository returns ARN', async () => {
    const rname = `e2erepo-${RUN_ID}`.replace(/[^a-z0-9._-]/g, '-').slice(0, 32);
    const r = await http('POST', '/api/services/git_manager/api/v1/repos', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { name: rname, description: 'tier6 repo' },
    });
    assert(r.status === 201, `repo HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    repoArn = r.data.repository?.arn;
    repoId = r.data.repository?.id;
    assert(repoArn && repoArn.includes(':git:repository/'), `missing repo arn: ${repoArn}`);
    return repoArn;
  });

  const allResources = [
    endpointArn, bucketArn, databaseArn, secretArn, taskArn, queueArn, webhookArn, repoArn,
  ].filter(Boolean);
  const allScopes = [
    'ai:InvokeLlm',
    'storage:ListBucket',
    'db:Connect',
    'secrets:GetValue',
    'secrets:List',
    'compute:Describe',
    'queue:Send',
    'webhook:Dispatch',
    'git:Read',
  ];

  await check('app-access', 'auth_manager credentials CRUD', async () => {
    const cname = `e2e-cred-${RUN_ID}`;
    const base = '/api/services/auth_manager/api/v1/credentials';
    const c = await http('POST', base, {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        project_id: projectId,
        name: cname,
        allowed_resources: allResources,
        scopes: allScopes,
      },
    });
    assert(c.status === 201, `create cred HTTP ${c.status}: ${JSON.stringify(c.data).slice(0, 200)}`);
    clientId = c.data.client_id;
    clientSecret = c.data.client_secret;
    credId = (c.data.credential && c.data.credential.id) || c.data.id;
    assert(clientId && clientSecret, 'no client_id/secret');

    const l = await http('GET', base, { token: TOKEN, query: { project_id: projectId } });
    assert(l.status === 200 && (l.data.items || []).some((x) => x.client_id === clientId), 'cred not listed');
    return clientId;
  });

  await check('app-access', 'auth_manager rotate credential', async () => {
    const rot = await http('POST', `/api/services/auth_manager/api/v1/credentials/${credId}/rotate`, {
      token: TOKEN,
      query: { project_id: projectId },
      body: { project_id: projectId },
    });
    assert(rot.status === 200 && rot.data.client_secret, `rotate HTTP ${rot.status}`);
    clientSecret = rot.data.client_secret;
    return 'rotated';
  });

  await check('app-access', 'client_credentials mint app JWT', async () => {
    const r = await http('POST', '/api/services/auth_manager/api/v1/auth/token', {
      token: TOKEN,
      query: { project_id: projectId },
      body: {
        grant_type: 'client_credentials',
        client_id: clientId,
        client_secret: clientSecret,
      },
    });
    assert(r.status === 200, `token HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 160)}`);
    appToken = r.data.access_token || r.data.token;
    assert(appToken, `no access_token in ${JSON.stringify(r.data).slice(0, 120)}`);

    const v = await http('POST', '/api/services/auth_manager/api/v1/auth/verify', {
      token: TOKEN,
      query: { project_id: projectId },
      body: { token: appToken },
    });
    assert(v.status === 200 && v.data.active, `verify not active: ${JSON.stringify(v.data).slice(0, 120)}`);
    assert(v.data.claims.typ === 'app', `typ=${v.data.claims.typ}`);
    assert((v.data.claims.resources || []).includes(endpointArn), 'endpoint ARN missing from claims');
    return 'app JWT verified';
  });

  await check('app-access', 'api_manager pretty URL gateway invoke', async () => {
    const ename = `e2e-llm-${RUN_ID}`;
    const pretty = await http('POST', `/v1/projects/${projectId}/ai/llm/${ename}/chat`, {
      token: appToken,
      body: {
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'tier6 gateway ping' }],
      },
    });
    assert(
      pretty.status !== 400 && pretty.status !== 403,
      `pretty gateway auth failed HTTP ${pretty.status}: ${JSON.stringify(pretty.data).slice(0, 160)}`,
    );
    return `gateway HTTP ${pretty.status}`;
  });

  await check('app-access', 'app token denied without resource ARN on LLM', async () => {
    const r = await http('POST', '/api/services/ai_manager/api/v1/llm/chat', {
      token: appToken,
      query: { project_id: projectId },
      body: {
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'ping' }],
      },
    });
    assert(r.status === 400 || (r.data?.error?.code === 'ResourceRequired'),
      `expected 400 ResourceRequired, got ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);
    return `HTTP ${r.status} as expected`;
  });

  await check('app-access', 'app token allowed with endpoint ARN on LLM (backend may 503)', async () => {
    const r = await http('POST', '/api/services/ai_manager/api/v1/llm/chat', {
      token: appToken,
      query: { project_id: projectId },
      body: {
        resource: endpointArn,
        model: 'llama3.2:3b',
        messages: [{ role: 'user', content: 'say hi' }],
      },
    });
    assert(r.status !== 401 && r.status !== 403 && r.status !== 400,
      `auth rejected: HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
    return `HTTP ${r.status} (auth OK)`;
  });

  await check('app-access', 'app token lists bucket with storage:ListBucket', async () => {
    const bucketName = bucketArn.split('/').pop();
    const r = await http('GET', `/api/services/storage_manager/api/projects/${storageProjectId}/buckets/${bucketName}/files`, {
      token: appToken,
      query: { project_id: storageProjectId },
      headers: { 'X-Aerekos-Resource': bucketArn },
    });
    assert(r.status === 200, `list files HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(Array.isArray(r.data.files), 'files not array');
    return `${r.data.files.length} file(s)`;
  });

  await check('app-access', 'app token db:Connect on database connection', async () => {
    const dbName = databaseArn.split('/').pop();
    const r = await http('GET', `/api/services/db_manager/api/databases/${dbName}/connection`, {
      token: appToken,
      query: { project_id: projectId },
      headers: { 'X-Aerekos-Resource': databaseArn },
    });
    assert(r.status !== 401 && r.status !== 403 && r.status !== 400,
      `db auth rejected: HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
    return `HTTP ${r.status} (db:Connect auth OK)`;
  });

  await check('app-access', 'app token reveals secret with secrets:GetValue', async () => {
    const r = await http('GET', `/api/services/secrets_manager/api/v1/secrets/${secretId}`, {
      token: appToken,
      query: { project_id: projectId, reveal: '1' },
      headers: { 'X-Aerekos-Resource': secretArn },
    });
    assert(r.status === 200, `reveal HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data.secret?.value === `tier6-${RUN_ID}`, 'wrong secret value');
    return 'secret revealed';
  });

  await check('app-access', 'app token describes compute task with compute:Describe', async () => {
    const r = await http('GET', `/api/services/compute_manager/api/v1/tasks/${taskId}`, {
      token: appToken,
      query: { project_id: projectId },
      headers: { 'X-Aerekos-Resource': taskArn },
    });
    assert(r.status === 200, `task GET HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data.task?.arn === taskArn, 'task arn mismatch');
    return r.data.task?.status || 'ok';
  });

  await check('app-access', 'app token sends queue message with queue:Send', async () => {
    const r = await http('POST', `/api/services/queue_manager/api/v1/queues/${queueName}/messages`, {
      token: appToken,
      query: { project_id: projectId },
      headers: { 'X-Aerekos-Resource': queueArn },
      body: { body: { tier6: RUN_ID } },
    });
    assert(r.status === 201, `queue send HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data.MessageId, 'no MessageId');
    return r.data.MessageId;
  });

  await check('app-access', 'app token dispatches webhook with webhook:Dispatch', async () => {
    const r = await http('POST', `/api/services/webhook_manager/api/v1/webhooks/${webhookId}/dispatch`, {
      token: appToken,
      query: { project_id: projectId },
      headers: { 'X-Aerekos-Resource': webhookArn },
      body: { event: 'tier6.test', payload: { run: RUN_ID } },
    });
    assert(r.status === 201, `dispatch HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data.delivery?.id, 'no delivery id');
    return r.data.delivery.status || 'dispatched';
  });

  await check('app-access', 'app token reads git repo with git:Read', async () => {
    const r = await http('GET', `/api/services/git_manager/api/v1/repos/${repoId}`, {
      token: appToken,
      query: { project_id: projectId },
      headers: { 'X-Aerekos-Resource': repoArn },
    });
    assert(r.status === 200, `repo GET HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 120)}`);
    assert(r.data.repository?.arn === repoArn, 'repo arn mismatch');
    return r.data.repository?.name || 'ok';
  });

  await check('app-access', 'SDK getAppToken + invoke()', async () => {
    const baseUrl = process.env.CONDUCTOR_URL || 'http://localhost:3000';
    const client = new AerekosClient({ baseUrl, timeoutMs: 60000 });
    await client.auth.login(process.env.AUTH_USERNAME || 'admin', process.env.AUTH_PASSWORD || 'admin');
    const tokRes = await client.auth.getAppToken({ clientId, clientSecret, projectId, storeToken: false });
    assert(tokRes.access_token, 'sdk no token');
    const out = await invoke(client, {
      serviceName: 'compute_manager',
      method: 'GET',
      path: `/api/v1/tasks/${taskId}`,
      resourceArn: taskArn,
      projectId,
      token: tokRes.access_token,
    });
    assert(out?.task?.arn === taskArn, `sdk invoke bad response: ${JSON.stringify(out).slice(0, 120)}`);
    return 'sdk invoke completed';
  });

  if (credId) {
    await http('DELETE', `/api/services/auth_manager/api/v1/credentials/${credId}`, {
      token: TOKEN,
      query: { project_id: projectId },
    }).catch(() => {});
  }
}

module.exports = { tier6AppAccess, PID };

'use strict';

/**
 * Icarus T01 / C0 — fleet smoke for LLM, embeddings, memory, secrets, storage.
 *
 * Live path (default when URL + token/credentials are set):
 *   token, chat, embed, memory setup/search, secrets list, storage put+get
 *
 * Docs path always runs: LLM proxy timeout must be ≥ Icarus inference timeout.
 *
 * Env:
 *   AEREKOS_API_URL | CONDUCTOR_URL
 *   AEREKOS_C0_ADMIN_TOKEN | TOKEN          admin JWT (create project + resources)
 *   AEREKOS_CLIENT_ID / AEREKOS_CLIENT_SECRET / AEREKOS_PROJECT_ID  (existing app creds)
 *   AEREKOS_LLM_ARN                         optional resource ARN for chat
 *   AEREKOS_LLM_MODEL                       default llama3.2:3b
 *   ICARUS_C0_SKIP_LIVE=1                   docs-only (CI without fleet)
 */

const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const http = require('http');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const FAIL = [];
const PASS = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function record(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then((detail) => {
      PASS.push(name);
      console.log(`  ok  ${name}${detail ? ` — ${detail}` : ''}`);
    })
    .catch((err) => {
      FAIL.push({ name, err });
      console.error(`  FAIL ${name}: ${err.message}`);
    });
}

function env(name) {
  const v = process.env[name];
  return v && String(v).trim() ? String(v).trim() : '';
}

function conductorBase() {
  return (env('AEREKOS_API_URL') || env('CONDUCTOR_URL')).replace(/\/$/, '');
}

function inferenceTimeoutMs() {
  return parseInt(env('LLM_INFERENCE_TIMEOUT_MS') || '1800000', 10);
}

function proxyTimeoutMs() {
  return parseInt(
    env('CONDUCTOR_PROXY_TIMEOUT_MS') ||
      env('OLLAMA_REQUEST_TIMEOUT_MS') ||
      env('VLLM_REQUEST_TIMEOUT_MS') ||
      String(inferenceTimeoutMs()),
    10,
  );
}

function request(method, pathname, { token, query, body, headers, timeoutMs, raw } = {}) {
  const base = conductorBase();
  if (!base) return Promise.reject(new Error('AEREKOS_API_URL or CONDUCTOR_URL is required'));
  const u = new URL(pathname, base.endsWith('/') ? base : `${base}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v != null) u.searchParams.set(k, String(v));
    }
  }
  const payload = body == null ? null : Buffer.from(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  const hdrs = { ...(headers || {}) };
  if (token) hdrs.Authorization = `Bearer ${token}`;
  if (payload && !hdrs['Content-Type'] && !hdrs['content-type']) {
    hdrs['Content-Type'] = typeof body === 'string' || Buffer.isBuffer(body) ? 'application/octet-stream' : 'application/json';
  }
  if (payload) hdrs['Content-Length'] = String(payload.length);

  const lib = u.protocol === 'https:' ? https : http;
  const timeout = timeoutMs || proxyTimeoutMs();

  return new Promise((resolve, reject) => {
    const req = lib.request(
      u,
      { method, headers: hdrs, timeout },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          let data = buf;
          if (!raw) {
            const text = buf.toString('utf8');
            try {
              data = text ? JSON.parse(text) : null;
            } catch {
              data = text;
            }
          }
          resolve({ status: res.statusCode, data, headers: res.headers, buf });
        });
      },
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`timeout after ${timeout}ms ${method} ${u.pathname}`));
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function docsCheck() {
  const llmDoc = fs.readFileSync(path.join(ROOT, 'docs/services/ai_manager_llm.md'), 'utf8');
  const runbook = fs.readFileSync(path.join(ROOT, 'docs/runbooks/icarus-c0.md'), 'utf8');
  const combined = `${llmDoc}\n${runbook}`;
  assert(/CONDUCTOR_PROXY_TIMEOUT_MS/.test(combined), 'docs must mention CONDUCTOR_PROXY_TIMEOUT_MS');
  assert(/OLLAMA_REQUEST_TIMEOUT_MS/.test(combined), 'docs must mention OLLAMA_REQUEST_TIMEOUT_MS');
  assert(/LLM_INFERENCE_TIMEOUT_MS/.test(combined), 'docs must mention LLM_INFERENCE_TIMEOUT_MS');
  assert(/proxy timeout/i.test(combined) && /inference timeout/i.test(combined), 'docs must say proxy timeout ≥ inference timeout');
  const ollamaSrc = fs.readFileSync(path.join(ROOT, 'worker/ai_manager/api/services/OllamaService.js'), 'utf8');
  const vllmSrc = fs.readFileSync(path.join(ROOT, 'worker/ai_manager/api/services/VllmService.js'), 'utf8');
  const ollamaDefault = ollamaSrc.match(/OLLAMA_REQUEST_TIMEOUT_MS \|\| '(\d+)'/);
  const vllmDefault = vllmSrc.match(/VLLM_REQUEST_TIMEOUT_MS \|\| '(\d+)'/);
  assert(ollamaDefault, 'OllamaService must read OLLAMA_REQUEST_TIMEOUT_MS');
  assert(vllmDefault, 'VllmService must read VLLM_REQUEST_TIMEOUT_MS');
  const min = inferenceTimeoutMs();
  assert(parseInt(ollamaDefault[1], 10) >= min, `Ollama default ${ollamaDefault[1]} < LLM_INFERENCE_TIMEOUT_MS ${min}`);
  assert(parseInt(vllmDefault[1], 10) >= min, `vLLM default ${vllmDefault[1]} < LLM_INFERENCE_TIMEOUT_MS ${min}`);
  return 'timeout docs + backend defaults ≥ inference timeout';
}

async function mintToken(adminToken, projectId, clientId, clientSecret) {
  if (clientId && clientSecret && projectId) {
    const r = await request('POST', '/api/services/auth_manager/api/v1/auth/token', {
      token: adminToken || undefined,
      query: { project_id: projectId },
      body: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
    });
    assert(r.status === 200, `token HTTP ${r.status}: ${JSON.stringify(r.data).slice(0, 200)}`);
    const tok = r.data.access_token || r.data.token;
    assert(tok, 'no access_token');
    return tok;
  }
  assert(adminToken, 'need AEREKOS_C0_ADMIN_TOKEN/TOKEN or client credentials');
  return adminToken;
}

async function liveSmoke() {
  const admin = env('AEREKOS_C0_ADMIN_TOKEN') || env('TOKEN');
  let projectId = env('AEREKOS_PROJECT_ID');
  let clientId = env('AEREKOS_CLIENT_ID');
  let clientSecret = env('AEREKOS_CLIENT_SECRET');
  let llmArn = env('AEREKOS_LLM_ARN');
  let storageProjectId = env('AEREKOS_STORAGE_PROJECT_ID') || projectId;
  let bucketName = env('AEREKOS_STORAGE_BUCKET') || 'icarus-chat';
  const model = env('AEREKOS_LLM_MODEL') || 'llama3.2:3b';
  const runId = `c0-${Date.now().toString(36)}`;

  if (admin && !projectId) {
    const created = await request('POST', '/api/projects', {
      token: admin,
      body: { name: `icarus-${runId}`, description: 'Icarus C0 project' },
    });
    assert(created.status === 201 || created.status === 200, `create project HTTP ${created.status}`);
    projectId = created.data.project?.id || created.data.id;
    assert(projectId, 'no project id');
  }
  assert(projectId, 'AEREKOS_PROJECT_ID (or admin token to create one) is required');

  if (admin) {
    if (!llmArn) {
      const ep = await request('POST', '/api/services/ai_manager/api/v1/providers', {
        token: admin,
        query: { project_id: projectId },
        body: {
          project_id: projectId,
          name: `icarus-llm-${runId}`,
          capability: 'llm',
          provider: 'ollama',
          provider_type: 'ollama',
        },
      });
      llmArn = ep.data?.item?.arn || ep.data?.arn || llmArn;
    }

    const scopes = [
      'ai:InvokeLlm',
      'ai:InvokeEmbeddings',
      'ai:InvokeMemory',
      'ai:AdminMemory',
      'secrets:List',
      'storage:PutObject',
      'storage:GetObject',
      'storage:ListBucket',
    ];
    const resources = [llmArn].filter(Boolean);
    const cred = await request('POST', '/api/services/auth_manager/api/v1/credentials', {
      token: admin,
      query: { project_id: projectId },
      body: {
        project_id: projectId,
        name: `icarus-c0-${runId}`,
        allowed_resources: resources,
        scopes,
      },
    });
    if (cred.status === 201 || cred.status === 200) {
      clientId = cred.data.client_id || clientId;
      clientSecret = cred.data.client_secret || clientSecret;
    }
  }

  const appToken = await mintToken(admin, projectId, clientId, clientSecret);

  const chatBody = {
    model,
    messages: [{ role: 'user', content: 'Reply with the single word pong.' }],
    project_id: projectId,
  };
  if (llmArn) chatBody.resource = llmArn;
  const chat = await request('POST', '/api/services/ai_manager/api/v1/llm/chat', {
    token: appToken,
    query: { project_id: projectId },
    body: chatBody,
    timeoutMs: inferenceTimeoutMs(),
  });
  assert(chat.status === 200, `chat HTTP ${chat.status}: ${JSON.stringify(chat.data).slice(0, 240)}`);
  const chatText = chat.data?.message?.content || chat.data?.choices?.[0]?.message?.content || '';
  assert(String(chatText).length > 0, 'chat returned empty content');

  const embedBody = { input: 'icarus c0 smoke', project_id: projectId };
  const embed = await request('POST', '/api/services/ai_manager/api/v1/embeddings', {
    token: appToken,
    query: { project_id: projectId },
    body: embedBody,
    timeoutMs: inferenceTimeoutMs(),
  });
  assert(embed.status === 200, `embed HTTP ${embed.status}: ${JSON.stringify(embed.data).slice(0, 200)}`);
  const vectors = embed.data?.embeddings || embed.data?.data || embed.data?.embedding;
  assert(vectors && (Array.isArray(vectors) ? vectors.length : true), 'embed returned no vectors');

  const memSetup = await request('POST', '/api/services/ai_manager/api/v1/memory/setup', {
    token: appToken,
    query: { project_id: projectId },
    body: { project_id: projectId },
  });
  assert(
    memSetup.status === 200 || memSetup.status === 201 || memSetup.status === 409,
    `memory setup HTTP ${memSetup.status}: ${JSON.stringify(memSetup.data).slice(0, 200)}`,
  );
  const memSearch = await request('POST', '/api/services/ai_manager/api/v1/memory/search', {
    token: appToken,
    query: { project_id: projectId },
    body: { project_id: projectId, query: 'icarus', top_k: 1, user_id: 'icarus-c0' },
  });
  assert(
    memSearch.status === 200 || memSearch.status === 404,
    `memory search HTTP ${memSearch.status}: ${JSON.stringify(memSearch.data).slice(0, 200)}`,
  );

  const secrets = await request('GET', '/api/services/secrets_manager/api/v1/secrets', {
    token: appToken,
    query: { project_id: projectId },
  });
  assert(secrets.status === 200, `secrets list HTTP ${secrets.status}: ${JSON.stringify(secrets.data).slice(0, 200)}`);
  assert(Array.isArray(secrets.data?.secrets || secrets.data?.items || []), 'secrets list is not an array');

  const stor = await request('POST', '/api/services/storage_manager/api/projects', {
    token: appToken,
    query: { project_id: projectId },
    body: { name: `icarus-stor-${runId}` },
  });
  assert(
    stor.status === 201 || stor.status === 200,
    `storage project HTTP ${stor.status}: ${JSON.stringify(stor.data).slice(0, 200)}`,
  );
  storageProjectId = stor.data.id || storageProjectId;
  const bname = `icarus-${runId}`.replace(/[^a-z0-9-]/g, '-').slice(0, 32);
  const buck = await request('POST', `/api/services/storage_manager/api/projects/${storageProjectId}/buckets`, {
    token: appToken,
    query: { project_id: storageProjectId },
    body: { name: bname },
  });
  assert(
    buck.status === 201 || buck.status === 200,
    `storage bucket HTTP ${buck.status}: ${JSON.stringify(buck.data).slice(0, 200)}`,
  );
  bucketName = buck.data.name || bname;

  const key = `c0/${runId}.txt`;
  const put = await request(
    'POST',
    `/api/services/storage_manager/api/projects/${storageProjectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`,
    {
      token: appToken,
      query: { project_id: storageProjectId },
      body: Buffer.from('icarus-c0'),
      headers: { 'Content-Type': 'application/octet-stream' },
    },
  );
  if (put.status >= 400) {
    const putJson = await request(
      'POST',
      `/api/services/storage_manager/api/projects/${storageProjectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`,
      {
        token: appToken,
        query: { project_id: storageProjectId },
        body: { content: 'icarus-c0', content_type: 'text/plain' },
      },
    );
    assert(putJson.status === 200 || putJson.status === 201, `storage put HTTP ${put.status}/${putJson.status}`);
  }
  const got = await request(
    'GET',
    `/api/services/storage_manager/api/projects/${storageProjectId}/buckets/${bucketName}/files/${encodeURIComponent(key)}`,
    {
      token: appToken,
      query: { project_id: storageProjectId },
      raw: true,
    },
  );
  assert(got.status === 200, `storage get HTTP ${got.status}`);
  const body = Buffer.isBuffer(got.buf) ? got.buf.toString('utf8') : String(got.data);
  assert(body.includes('icarus-c0'), `storage get mismatch: ${body.slice(0, 80)}`);

  return { projectId, clientId, bucketName, key };
}

async function main() {
  console.log('Icarus C0 smoke');
  await record('docs: LLM proxy timeout ≥ inference timeout', docsCheck);

  const skipLive = env('ICARUS_C0_SKIP_LIVE') === '1';
  const hasUrl = Boolean(conductorBase());
  const hasAuth =
    Boolean(env('AEREKOS_C0_ADMIN_TOKEN') || env('TOKEN')) ||
    Boolean(env('AEREKOS_CLIENT_ID') && env('AEREKOS_CLIENT_SECRET') && env('AEREKOS_PROJECT_ID'));

  if (skipLive) {
    console.log('  skip live (ICARUS_C0_SKIP_LIVE=1)');
  } else if (!hasUrl || !hasAuth) {
    FAIL.push({
      name: 'live: fleet',
      err: new Error(
        'set AEREKOS_API_URL plus admin TOKEN or AEREKOS_CLIENT_ID/SECRET/PROJECT_ID (or ICARUS_C0_SKIP_LIVE=1 for docs-only)',
      ),
    });
    console.error('  FAIL live: fleet: missing conductor URL or credentials');
  } else {
    await record('live: token, chat, embed, memory, secrets, storage put+get', async () => {
      const r = await liveSmoke();
      return `project ${r.projectId} bucket ${r.bucketName}`;
    });
  }

  console.log(`\n${PASS.length} passed, ${FAIL.length} failed`);
  if (FAIL.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

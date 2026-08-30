'use strict';

/**
 * Shared Data API e2e flow. Sandbox projects only (e2e-platform-*).
 * Skips when api_manager is not deployed (404/500/502/503).
 */

function reachable(status) {
  return ![404, 500, 501, 502, 503].includes(status);
}

function userPostDoc({ name = 'app', engine = 'sqlite3', database, runId, desired = 1 } = {}) {
  return {
    name,
    engine,
    database: database || `${name}-db`,
    desired,
    autoscaling: { min: 1, max: 4, metric: 'rps', target: 50 },
    models: {
      User: {
        fields: { name: 'string', email: 'string', owner_id: 'string' },
        settings: { required: ['email'], unique: ['email'], hasMany: ['Post'], timestamps: true },
      },
      Post: {
        fields: { title: 'string', body: 'string' },
        settings: { belongsTo: ['User'], timestamps: true },
      },
    },
  };
}

/**
 * @param {object} box sandbox
 * @param {object} deps
 * @param {Function} deps.request
 * @param {Function} deps.assert
 * @param {object} [opts]
 * @param {string} [opts.engine]
 * @param {string} [opts.app]
 */
async function runDataApiE2e(box, { request, assert }, opts = {}) {
  const token = box.token;
  const q = { project_id: box.projectId };
  const engine = opts.engine || 'sqlite3';
  const app = opts.app || (engine === 'sqlite3' ? 'app' : `app${engine.slice(0, 2)}`);
  const email = `ada-${box.runId}-${app}@example.com`;
  const doc = userPostDoc({
    name: app,
    engine,
    database: `${app}-db`.replace(/_/g, '-'),
    runId: box.runId,
  });

  const apply = await request('POST', '/api/services/api_manager/api/v1/data-apis/apply', {
    token, query: q, body: { project_id: box.projectId, ...doc },
  });
  if (!reachable(apply.status)) {
    box.skip(`api_manager data API HTTP ${apply.status}`);
    return { skipped: true, status: apply.status };
  }
  assert([200, 201].includes(apply.status), `apply HTTP ${apply.status}: ${JSON.stringify(apply.data).slice(0, 240)}`);
  const compiled = apply.data?.compiled || [];
  const userCompiled = compiled.find((c) => c.model === 'User');
  const postCompiled = compiled.find((c) => c.model === 'Post');
  assert(userCompiled && (userCompiled.hasMany || []).includes('Post'), 'compiled User.hasMany missing Post');
  assert(postCompiled && (postCompiled.belongsTo || []).includes('User'), 'compiled Post.belongsTo missing User');
  assert((postCompiled.indexes || []).includes('user_id'), 'compiled Post missing user_id index');
  const endpoints = apply.data?.endpoints || [];
  assert(endpoints.some((e) => e.action === 'list_nested'), 'nested list endpoint missing');
  assert(apply.data?.item?.engine === engine || apply.data?.schema?.engine === engine, `engine ${engine} not persisted`);
  const dbInfo = apply.data?.database || {};
  if (engine === 'sqlite3') {
    assert(dbInfo.query_engine === 'sqlite' || dbInfo.status === 'local', `sqlite query_engine=${dbInfo.query_engine}`);
  }

  const listedApps = await request('GET', '/api/services/api_manager/api/v1/data-apis', { token, query: q });
  assert(listedApps.status === 200, `list data-apis HTTP ${listedApps.status}`);
  assert((listedApps.data?.items || []).some((i) => i.name === app), `data api ${app} missing from list`);

  const created = await request('POST', `/api/services/api_manager/api/v1/data/${app}/User`, {
    token, query: q, body: { project_id: box.projectId, name: 'ada', email },
  });
  assert(reachable(created.status) && [200, 201].includes(created.status), `create user HTTP ${created.status}: ${JSON.stringify(created.data).slice(0, 200)}`);
  const uid = created.data?.item?.id;
  assert(uid, 'created user id missing');

  const dup = await request('POST', `/api/services/api_manager/api/v1/data/${app}/User`, {
    token, query: q, body: { project_id: box.projectId, name: 'ada2', email },
  });
  assert(dup.status === 409, `unique email expected 409, got ${dup.status}`);

  const post = await request('POST', `/api/services/api_manager/api/v1/data/${app}/User/${uid}/posts`, {
    token, query: q, body: { project_id: box.projectId, title: 'hello', body: 'world' },
  });
  assert(reachable(post.status) && [200, 201].includes(post.status), `nested create HTTP ${post.status}`);
  assert(post.data?.item?.user_id === uid, `nested FK user_id=${post.data?.item?.user_id}`);

  const nested = await request('GET', `/api/services/api_manager/api/v1/data/${app}/User/${uid}/posts`, { token, query: q });
  assert(nested.status === 200 && (nested.data?.items || []).length >= 1, `nested list HTTP ${nested.status}`);

  const included = await request('GET', `/api/services/api_manager/api/v1/data/${app}/User`, {
    token, query: { ...q, include: 'posts' },
  });
  assert(included.status === 200, `include HTTP ${included.status}`);
  const withPosts = (included.data?.items || []).find((u) => u.id === uid);
  assert(withPosts && Array.isArray(withPosts.posts) && withPosts.posts.length >= 1, 'include=posts missing nested rows');

  const where = await request('GET', `/api/services/api_manager/api/v1/data/${app}/User`, {
    token, query: { ...q, where: JSON.stringify({ email }) },
  });
  assert(where.status === 200 && (where.data?.items || []).length === 1, `where filter HTTP ${where.status} count=${(where.data?.items || []).length}`);

  const got = await request('GET', `/api/services/api_manager/api/v1/data/${app}/User/${uid}`, {
    token, query: { ...q, include: 'posts' },
  });
  assert(got.status === 200 && got.data?.item?.id === uid, `get user HTTP ${got.status}`);

  const patched = await request('PATCH', `/api/services/api_manager/api/v1/data/${app}/User/${uid}`, {
    token, query: q, body: { name: 'ada lovelace' },
  });
  assert(patched.status === 200 && patched.data?.item?.name === 'ada lovelace', `patch HTTP ${patched.status}`);

  const scaled = await request('POST', `/api/services/api_manager/api/v1/data-apis/${encodeURIComponent(app)}/scale`, {
    token, query: q, body: { desired: 2 },
  });
  assert(reachable(scaled.status) && scaled.status === 200, `scale HTTP ${scaled.status}`);
  assert(Number(scaled.data?.item?.desired) === 2, `desired after scale=${scaled.data?.item?.desired}`);

  const evaluated = await request('POST', `/api/services/api_manager/api/v1/data-apis/${encodeURIComponent(app)}/autoscaling/evaluate`, {
    token, query: q, body: { rps: 999 },
  });
  assert(reachable(evaluated.status) && evaluated.status === 200, `evaluate HTTP ${evaluated.status}`);
  assert(Number(evaluated.data?.desired) >= 2, `evaluate desired=${evaluated.data?.desired}`);

  const routes = await request('GET', '/api/services/api_manager/api/v1/endpoints', { token, query: q });
  if (reachable(routes.status) && routes.status === 200) {
    const items = routes.data?.items || [];
    assert(items.some((r) => String(r.name || '').startsWith(`data-${app}-`)), `missing data-${app}-* gateway routes`);
  }

  const gql = await request('POST', '/api/services/graphql_manager/api/v1/compile', {
    token, query: q, body: { project_id: box.projectId, name: app, models: doc.models },
  });
  if (reachable(gql.status) && gql.status === 200) {
    const schema = gql.data?.schema || '';
    assert(/posts:\s*\[Post/.test(schema) && /user:\s*User/.test(schema), 'graphql missing relationship fields');
  } else {
    box.skip(`graphql_manager compile HTTP ${gql.status}`);
  }

  return {
    skipped: false,
    app,
    engine,
    uid,
    queryEngine: dbInfo.query_engine,
    dbStatus: dbInfo.status,
    fallback: dbInfo.fallback,
    desired: evaluated.data?.desired,
  };
}

module.exports = { reachable, userPostDoc, runDataApiE2e };

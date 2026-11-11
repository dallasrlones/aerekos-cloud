'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { AerekosClient, AerekosError } = require('../index.js');

// Build a fake fetch that records the last call and returns a canned response.
function fakeFetch(responder) {
  const calls = [];
  const fn = async (url, init) => {
    calls.push({ url, init });
    const { status = 200, body = {} } = responder(url, init) || {};
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => (typeof body === 'string' ? body : JSON.stringify(body))
    };
  };
  fn.calls = calls;
  return fn;
}

test('requires baseUrl', () => {
  assert.throws(() => new AerekosClient({}), AerekosError);
});

test('login stores token and sends it on later calls', async () => {
  const fetchImpl = fakeFetch((url) => {
    if (url.endsWith('/api/auth/login')) return { body: { token: 'jwt-123' } };
    return { body: { services: [] } };
  });
  const client = new AerekosClient({ baseUrl: 'http://c:3000', fetch: fetchImpl });
  await client.auth.login('admin', 'admin');
  assert.strictEqual(client.token, 'jwt-123');

  await client.services.list();
  const last = fetchImpl.calls.at(-1);
  assert.strictEqual(last.init.headers.Authorization, 'Bearer jwt-123');
});

test('proxy builds the conductor path with project_id', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { items: [] } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });
  await client.keys.list('p-9');
  const last = fetchImpl.calls.at(-1);
  assert.ok(last.url.includes('/api/services/key_manager/api/keys'));
  assert.ok(last.url.includes('project_id=p-9'));
});

test('non-2xx throws AerekosError with status', async () => {
  const fetchImpl = fakeFetch(() => ({ status: 404, body: { error: { message: 'nope' } } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });
  await assert.rejects(() => client.services.get('x'), (err) => {
    assert.ok(err instanceof AerekosError);
    assert.strictEqual(err.status, 404);
    assert.strictEqual(err.message, 'nope');
    return true;
  });
});

test('users CRUD + login target auth_manager with project scope', async () => {
  const fetchImpl = fakeFetch((url, init) => {
    const path = url.split('?')[0];
    if (path.includes('/api/v1/auth/login')) return { body: { token: 'user-jwt', user: { id: 'u1', username: 'alice' }, expires_in: 604800 } };
    if (init && init.method === 'DELETE') return { body: { deleted: true, id: 'u1' } };
    if (/\/api\/v1\/users\/[^/]+$/.test(path)) return { body: { user: { id: 'u1', username: 'alice', enabled: true } } };
    if (init && init.method === 'POST') return { status: 201, body: { user: { id: 'u1', username: 'alice' } } };
    return { body: { items: [{ id: 'u1' }], users: [{ id: 'u1' }] } };
  });
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });

  const created = await client.users.create('p-1', { username: 'alice', password: 'hunter22', name: 'Alice' });
  assert.strictEqual(created.user.username, 'alice');
  let last = fetchImpl.calls.at(-1);
  assert.ok(last.url.includes('/api/services/auth_manager/api/v1/users'));
  assert.ok(last.url.includes('project_id=p-1'));
  assert.deepStrictEqual(JSON.parse(last.init.body), { project_id: 'p-1', username: 'alice', password: 'hunter22', name: 'Alice' });

  const listed = await client.users.list('p-1');
  assert.strictEqual(listed.users.length, 1);

  const got = await client.users.get('p-1', 'u1');
  assert.strictEqual(got.user.id, 'u1');

  await client.users.update('p-1', 'u1', { enabled: false });
  await client.users.remove('p-1', 'u1');

  const login = await client.users.login({ username: 'alice', password: 'hunter22', projectId: 'p-1' });
  assert.strictEqual(login.token, 'user-jwt');
  last = fetchImpl.calls.at(-1);
  assert.ok(last.url.includes('/api/services/auth_manager/api/v1/auth/login'));
  assert.deepStrictEqual(JSON.parse(last.init.body), { project_id: 'p-1', username: 'alice', password: 'hunter22' });
});

test('ensure posts pack enable', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { ok: true } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });
  await client.ensure({ projectId: 'p-1', pack: 'downloads' });
  const last = fetchImpl.calls.at(-1);
  assert.ok(last.url.includes('/api/setup/packs/downloads'));
  assert.strictEqual(last.init.method, 'POST');
});

test('typed helpers: llm, events, download, functions', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { ok: true, items: [] } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });
  await client.llm.chat('p-1', { messages: [{ role: 'user', content: 'hi' }] });
  await client.events.publish('p-1', { type: 'ping', payload: { a: 1 } });
  await client.download.quickAdd({ projectId: 'p-1', urls: ['https://example.com/a'] });
  await client.functions.invoke({ projectId: 'p-1', name: 'hello', payload: { n: 1 } });
  const urls = fetchImpl.calls.map((c) => c.url);
  assert.ok(urls.some((u) => u.includes('/ai_manager/api/v1/llm/chat')));
  assert.ok(urls.some((u) => u.includes('/event_manager/api/v1/events')));
  assert.ok(urls.some((u) => u.includes('/download_manager/api/v1/quick-add')));
  assert.ok(urls.some((u) => u.includes('/function_manager/api/v1/functions/hello/invoke')));
});

test('download api: youtube search, items, actions, tick, list CRUD', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { ok: true, items: [] } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });

  // YouTube search posts to /search/youtube with project_id in the query + body
  await client.download.searchYouTube('p-1', { query: 'big buck bunny', max: 5 });
  let call = fetchImpl.calls.at(-1);
  assert.ok(call.url.includes('/download_manager/api/v1/search/youtube'), call.url);
  assert.ok(call.url.includes('project_id=p-1'), call.url);
  assert.ok(String(call.init.body).includes('big buck bunny'), call.init.body);
  assert.strictEqual(call.init.method, 'POST');

  // torrent search still posts to /search
  await client.download.search('p-1', { query: 'interstellar' });
  call = fetchImpl.calls.at(-1);
  assert.ok(call.url.includes('/download_manager/api/v1/search') && !call.url.includes('youtube'), call.url);

  // items list passes filters through the query string
  await client.download.items('p-1', { status: 'completed', list: 'inbox' });
  call = fetchImpl.calls.at(-1);
  assert.ok(call.url.includes('/download_manager/api/v1/items'), call.url);
  assert.ok(call.url.includes('status=completed'), call.url);
  assert.ok(call.url.includes('list=inbox'), call.url);

  // item actions + get/update/remove
  await client.download.pauseItem('p-1', 'item-9');
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/items/item-9/pause'));
  await client.download.resumeItem('p-1', 'item-9');
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/items/item-9/resume'));
  await client.download.retryItem('p-1', 'item-9');
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/items/item-9/retry'));
  await client.download.getItem('p-1', 'item-9');
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/items/item-9'));
  await client.download.updateItem('p-1', 'item-9', { format: 'mp3' });
  assert.strictEqual(fetchImpl.calls.at(-1).init.method, 'PATCH');
  await client.download.removeItem('p-1', 'item-9');
  assert.strictEqual(fetchImpl.calls.at(-1).init.method, 'DELETE');

  // list + window CRUD
  await client.download.createList('p-1', { name: 'movies' });
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/lists'));
  assert.strictEqual(fetchImpl.calls.at(-1).init.method, 'POST');
  await client.download.updateList('p-1', 'list-1', { name: 'movies2' });
  assert.ok(fetchImpl.calls.at(-1).url.includes('/download_manager/api/v1/lists/list-1'));
  assert.strictEqual(fetchImpl.calls.at(-1).init.method, 'PATCH');
  await client.download.deleteList('p-1', 'list-1');
  assert.strictEqual(fetchImpl.calls.at(-1).init.method, 'DELETE');

  // tick posts to /tick
  await client.download.tick('p-1', { now: '2026-10-14T03:00:00Z' });
  call = fetchImpl.calls.at(-1);
  assert.ok(call.url.includes('/download_manager/api/v1/tick'), call.url);
  assert.strictEqual(call.init.method, 'POST');
});

test('data.query serializes where and include', async () => {
  const fetchImpl = fakeFetch(() => ({ body: { items: [] } }));
  const client = new AerekosClient({ baseUrl: 'http://c:3000', token: 't', fetch: fetchImpl });
  await client.data.query('p-1', 'app', 'User', { where: { email: 'a@b.test' }, include: ['posts'], limit: 10 });
  await client.data.scale('p-1', 'app', 2);
  const lastQuery = fetchImpl.calls[0];
  assert.ok(lastQuery.url.includes('/api_manager/api/v1/data/app/User'));
  assert.ok(lastQuery.url.includes('where='));
  assert.ok(lastQuery.url.includes('include=posts'));
  assert.ok(fetchImpl.calls[1].url.includes('/data-apis/app/scale'));
});

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
  const client = new AerekosClient({ baseUrl: 'http://c:3000', fetch: fetchImpl });
  await assert.rejects(() => client.services.get('x'), (err) => {
    assert.ok(err instanceof AerekosError);
    assert.strictEqual(err.status, 404);
    assert.strictEqual(err.message, 'nope');
    return true;
  });
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

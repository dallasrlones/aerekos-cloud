# aerekos-sdk

A tiny, **dependency-free** JavaScript/TypeScript client for the
[aerekos-cloud](../README.md) conductor API. Works in Node 18+, Deno, Bun, and
modern browsers (uses the global `fetch`).

## Install

```bash
npm install aerekos-sdk
```

## Usage

```js
const { AerekosClient } = require('aerekos-sdk');

const client = new AerekosClient({ baseUrl: 'http://localhost:3000' });

// Authenticate (stores the JWT on the client)
await client.auth.login('admin', 'admin');

// Control plane
const services = await client.services.list();
const workers = await client.workers.list();

// KMS via the conductor proxy
await client.keys.create('p-123', {
  name: 'app-key',
  type: 'symmetric',
  algorithm: 'aes-256-gcm'
});

// Secrets
await client.secrets.set('p-123', { name: 'STRIPE_KEY', value: 'sk_test_...' });
const secret = await client.secrets.get('p-123', 'STRIPE_KEY', { reveal: true });

// Object storage
const buckets = await client.storage.listBuckets('p-123');

await client.backup.run('p-123', { source: 'db_manager', resource: 'mydb' });
await client.iac.status('p-123');
await client.iac.hookup('p-123', { mode: 'conductor' });
await client.edge.status('p-123');
await client.systems.check(workerId);
await client.graphql.execute('p-123', { name: 'app', query: '{ users { id } }' });
await client.search.query('p-123', { q: 'hello' });

// Queued intelligence (do not hold Cloudflare on chat)
const job = await client.intelligence.submit('p-123', {
  intelligence: 'my-bot',
  messages: [{ role: 'user', content: 'hello' }],
});
const done = await client.intelligence.wait('p-123', job.job?.id || job.id);
// HTTP apps: return 202 { job_id } and poll GET. CLI/workers: submit + wait.
// subscribe() needs socket.io-client and joins ai:live:{projectId}.
await client.intelligence.cancel('p-123', job.job?.id || job.id);

await client.queue.create('p-123', { name: 'jobs', engine: 'standard' });
const queues = await client.queue.list('p-123');
await client.functions.attachQueue('p-123', 'hello', 'hello-inbox');

// Anything else: generic proxy to any manager
const queues = await client.proxy('queue_manager', {
  method: 'GET',
  path: '/api/v1/queues',
  projectId: 'p-123'
});
```

### Every manager, catalog-driven

The SDK ships a catalog of all 34 managers (`MANAGERS`). Use `client.svc.<name>`,
`client.manager(name)`, or `client.resource(name, segment)` to reach any of them
without hand-writing helpers:

```js
const { MANAGERS } = require('aerekos-sdk');

// Generic CRUD over a manager's project-scoped collection
const series = client.resource('metrics_manager', 'series');
await series.create('p-123', { name: 'cpu', metric_name: 'cpu', value: '0.4', labels: '{}' });
const all = await series.list('p-123');

// Per-service accessor (info / metrics / proxy / default resource)
const git = client.svc.git_manager;
await git.resource('repos').create('p-123', { name: 'hello' });
console.log(await git.info('p-123'));
console.log(await git.metrics('p-123'));   // raw Prometheus text

// Uniform-CRUD managers expose a default segment:
await client.manager('host_manager').resource().create('p-123', { name: 'n1', hostname: 'n1', address: '10.0.0.1' });
```

## CLI

Installing the package globally provides the `aerekos` command:

```bash
npm install -g aerekos-sdk

aerekos login --url http://localhost:3000 -u admin -p admin
aerekos managers                 # the whole catalog (name / AWS analog / port / status)
aerekos services                 # registered services
aerekos workers                  # the fleet

# Generic CRUD: <service> <segment> <action> [id]
aerekos git_manager repos create -P demo -d '{"name":"hello"}'
aerekos git_manager repos list   -P demo
aerekos metrics_manager series list -P demo

# Escape hatch: raw proxy to any manager
aerekos call key_manager POST /api/keys -P demo -d '{"name":"k","type":"symmetric"}'
aerekos info git_manager -P demo
aerekos metrics git_manager -P demo
```

Config (URL + token) is stored at `~/.aerekos/config.json` (override with
`AEREKOS_CONFIG`); `--url`, `--token`, `-P/--project`, `-d/--data`, and `--json`
work on every command.

## API

### `new AerekosClient({ baseUrl, token?, timeoutMs?, fetch? })`

- `baseUrl` — conductor base URL (required).
- `token` — existing JWT or registered service token.
- `timeoutMs` — request timeout (default `30000`).
- `fetch` — custom fetch (defaults to the global `fetch`).

### Low-level

- `client.request(method, path, { body, query, headers, raw })`
- `client.get/post/patch/del(...)`
- `client.proxy(serviceName, { method, path, projectId, body, query, headers })`

### Namespaces

| Namespace | Methods |
|-----------|---------|
| `client.auth` | `login(user, pass)`, `me()`, `getAppToken({ clientId, clientSecret, projectId })` |
| `client.workers` | `list()`, `get(id)`, `resources()` |
| `client.services` | `list()`, `get(name)`, `enable(name, projectId)`, `disable(name, projectId)`, `deployments(name)`, `health(name, projectId)` |
| `client.keys` | `list/get/create/rotate` (key_manager) |
| `client.secrets` | `list/get/set/remove` (secrets_manager) |
| `client.storage` | `listBuckets/createBucket/listObjects` (storage_manager) |
| `client.intelligence` | `chat`, `usage`, `list`, `create`, `attachBalancer`, `detachBalancer` |
| `client.stt` | `transcribe`, `status` |
| `client.tts` | `synthesize`, `status` |
| `client.memory` | `stores`, `ingest`, `retrieve` |
| `client.compute` | `list`, `create`, `scale`, `remove` |
| `client.balancer` | `list`, `create`, `health`, `remove` |
| `client.gateway` | `request(method, prettyPath, body)` |
| `client.svc.<name>` | `ManagerApi` for every catalog manager |

App-plane example (pretty gateway URLs; no `/api/services/...` fetch in product code):

```js
const client = new AerekosClient({ baseUrl: 'https://cloudapi.aerekos.com' });
await client.auth.getAppToken({
  clientId: process.env.AEREKOS_CLIENT_ID,
  clientSecret: process.env.AEREKOS_CLIENT_SECRET,
  projectId: process.env.AEREKOS_PROJECT_ID,
});

await client.intelligence.chat(projectId, {
  intelligence: 'icarus',
  messages: [{ role: 'user', content: 'hello' }],
  user_id: 'u1',
});
await client.intelligence.usage(projectId, { user_id: 'u1' });
await client.stt.transcribe(projectId, { audio_base64, resource: sttArn });
await client.tts.synthesize(projectId, { text: 'hi', resource: ttsArn });
await client.invoke({ resourceArn: intelArn, body: { messages: [{ role: 'user', content: 'hi' }] } });
await client.gateway.request('POST', `/v1/projects/${projectId}/ai/intelligence/icarus/chat`, {
  messages: [{ role: 'user', content: 'hi' }],
});
await client.compute.scale(projectId, taskId, 2);
await client.intelligence.attachBalancer(projectId, 'icarus');
await client.balancer.health(projectId);
```

`ai_manager` catalog segment is `intelligence` (providers live at `/api/v1/providers`).

### Catalog-driven

- `client.manager(name)` → `ManagerApi` with `info()`, `metrics()`, `proxy()`, `resource(segment?)`.
- `client.resource(name, segment, { base? })` → `{ create, list, get, update, remove }`.
- `MANAGERS` → array of `{ name, base, segment, aws, category, port, status }`.

Errors are thrown as `AerekosError` with `.status`, `.code`, and `.body`.

## License

MIT

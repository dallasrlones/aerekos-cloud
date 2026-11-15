# Storage Manager Service

S3-compatible object storage for aerekos-cloud: **Projects → Buckets → Files**, envelope encryption via **key_manager**, chunked uploads, and signed URLs.

## Status

**Implemented** — REST under `/api/projects/…` and `/api/systems/…`. Full contract: [`api/openapi.yaml`](./api/openapi.yaml). Conductor pack paths also appear in `docs/openapi/ga-managers.generated.yaml`.

**Tutorial:** none (standalone). No conductor ServiceGuide for this manager.

## No production mocks

`MOCK_KEY_MANAGER=true` is for **tests and local-only** encryption without conductor/`key_manager`. The process **exits** if `NODE_ENV=production` and `MOCK_KEY_MANAGER=true`. Compose sets `MOCK_KEY_MANAGER=${STORAGE_MOCK_KEY_MANAGER:-false}`. Production must use real key_manager through conductor.

## Auth

- API routes require `Authorization: Bearer …`.
- Middleware accepts conductor **`POST /api/services/validate-token`** or **`auth_manager` verify** (see `api/middleware/auth.js`).
- Compose: `AUTH_REQUIRED=${AUTH_REQUIRED:-true}`. When `AUTH_REQUIRED=true` and mock is off, startup **exits** if key_manager health via conductor fails.

## Features

- Project-based hierarchy; system buckets for host paths
- Automatic encryption with per-bucket keys from key_manager
- Chunked / multipart uploads for large objects
- Signed upload/download URLs with TTLs

### Host devices & performance *(planned)*

Drive detection and throughput tiers are sketched in **`plan.md`** → *Host drives, devices & performance* — not shipped.

## Architecture

### Dependencies

- **Conductor** — registration, proxy, validate-token
- **key_manager** — encryption keys (required unless mock / local)
- **auth_manager** — optional verify path for app JWTs
- **db_manager** — preferred metadata DB; falls back to SQLite

## Setup

```bash
cd worker/storage_manager
cp .env_example .env
npm install
npm start
```

Docker (build context is `worker/`):

```bash
docker compose -f docker-compose.yml up --build
```

## Configuration

See [`.env_example`](./.env_example). Important vars:

| Variable | Notes |
|----------|--------|
| `STORAGE_PATH` | Object byte root (default `./storage`) — not `STORAGE_ROOT` |
| `CONDUCTOR_URL` | Required for real key_manager |
| `AUTH_REQUIRED` | `true` in prod compose |
| `AUTH_MANAGER_URL` | For auth_manager verify fallback |
| `MOCK_KEY_MANAGER` | `false` for prod; local/tests only |

## SDK / CLI

No dedicated typed client. Use generic proxy:

```js
await client.proxy('storage_manager', {
  method: 'POST',
  path: '/api/projects/:projectId/buckets',
  projectId: PID,
  body: { name: 'demo' },
});
```

```bash
aerekos call storage_manager POST "/api/projects/:projectId/buckets" --project $PID --data '{"name":"demo"}'
```

## Testing

```bash
# Prefer Node 20 for better-sqlite3 native builds on this package pin
npm test                 # unit + integration + e2e (105 tests)
npm run test:coverage
```

See `tests/README.md`. Tests set `MOCK_KEY_MANAGER=true` via `tests/helpers/setup.js`; that is not a prod path.

## Health

- `GET /health` — liveness (DB + writable `STORAGE_PATH`)
- `GET /ready` — readiness including key_manager via conductor (skipped only when mock)
- `GET /metrics` — Prometheus

## Related

- `docs/services/storage_manager.md` — catalog surface
- `docs/runbooks/auth-required.md` — AUTH_REQUIRED flip
- `plan.md` — deeper design / future storage-pro items

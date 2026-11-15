# Key Manager Service (KMS)

Enterprise key management for aerekos-cloud: master-key-wrapped data keys, lifecycle (create / rotate / archive / delete), and service-to-service auth via conductor.

## Status

**Implemented (GA core)** — SQLite key store, AES-256-GCM master wrap, REST under `/api/keys*`. Conductor UI: **Key Manager** (in-app ServiceGuide). Proxied as `/api/services/key_manager/*`.

**Tutorial:** none standalone. Use ServiceGuide + this README / OpenAPI / [`docs/services/key_manager.md`](../../docs/services/key_manager.md).

## Default port

**`3102`** (host and container). Matches [`conductor/api/config/managerServicePorts.js`](../../conductor/api/config/managerServicePorts.js) and seed config. (Legacy docs/defaults said `3002`; fleet + conductor map use `3102`.)

## Health / proxy honesty

| Path | Role |
|------|------|
| `GET /health` | Liveness (SQLite) |
| `GET /ready` | Readiness (DB + `MASTER_KEY`) |

Conductor exempts `/health` and `/ready` from `projectId` gating (`isLiveness`). Prefer those for inventory probes — do not require a project query on liveness.

## No production mocks

There is no `MOCK_KEY_MANAGER` inside this process — this **is** the real KMS. Downstream services may mock key_manager for laptop tests only. Boot **exits** if `MASTER_KEY` is missing, or if `NODE_ENV=production` and `MASTER_KEY` is an all-zero dummy. Prefer USB / mounted `master.key` in production; keep dev defaults out of prod.

## Quick start (local)

```bash
cd worker/key_manager
cp .env_example .env
# set MASTER_KEY to 64 hex chars; PORT=3102
npm install
npm run dev
# curl http://localhost:3102/health
```

## Environment

See [`.env_example`](./.env_example). Important: `PORT`, `MASTER_KEY`, `CONDUCTOR_URL`, `DATABASE_PATH`.

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness |
| GET | /api/info | Service metadata (no auth) |
| GET | /metrics | Key counts |
| POST | /api/keys | Create key |
| GET | /api/keys | List keys |
| GET | /api/keys/:name | Get key (+ `key_material` when authorized) |
| POST | /api/keys/:name/rotate | Rotate |
| POST | /api/keys/:name/archive | Archive |
| DELETE | /api/keys/:name | Delete all versions |

Auth required on `/api/*` (conductor JWT or service token). Full schema: [`api/openapi.yaml`](./api/openapi.yaml) and [`docs/openapi/key_manager.yaml`](../../docs/openapi/key_manager.yaml).

## SDK / CLI

No dedicated typed client yet. Use generic proxy / CLI:

**SDK (Node)** — `client.proxy('key_manager', { method, path, projectId, body })`

**CLI** — `aerekos call key_manager POST "/api/keys" --project $PID --data '{"name":"demo","type":"symmetric","algorithm":"AES-256-GCM"}'`

## Docker

```bash
docker compose -f docker-compose.yml up --build
```

USB master key: see `docker-compose.yml` / `scripts/docker-entrypoint.sh`.

## Testing

| Layer | Command | Notes |
|-------|---------|-------|
| Unit + integration | `npm test` | Jest; in-memory SQLite; mocked conductor |
| Unit only | `npm test -- tests/unit` | Includes health honesty + prod master-key guard |
| Coverage | `npm run test:coverage` | |

## Related

- Conductor port map + `isLiveness`: `managerServicePorts.js`, `ServiceManager.js`
- Consumers: `storage_manager`, `secrets_manager`, `db_manager`
- Runbook (consumers): [`docs/runbooks/mock-key-manager-prod.md`](../../docs/runbooks/mock-key-manager-prod.md)

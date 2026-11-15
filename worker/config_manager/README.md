# config_manager

**AWS analog:** AppConfig · **Port:** `3136`

Project-scoped **config namespaces** (name + JSON `flags`) with `POST /api/v1/evaluate` to read a stored flag. SQLite via `aerekos-record`. No production mocks — shared `assertNoSkipFakes()` rejects skip/fake env in prod.

## Status

**MVP / implemented** — namespaces CRUD, evaluate, `ensure-defaults` (seed `app` / `{ example: false }`), `/health`, `/ready`, `/api/v1/info`, `/metrics`.

**Tutorial:** none (no ServiceGuide for this manager).

## Access

- Direct: `http://localhost:3136/...`
- Conductor proxy: `{CONDUCTOR}/api/services/config_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `app` namespace if empty |
| `POST` | `/api/v1/namespaces` | Create namespace (`project_id`, `name`, optional `flags` JSON string) |
| `GET` | `/api/v1/namespaces` | List (`?project_id=`) |
| `GET` | `/api/v1/namespaces/:id` | Get one |
| `PATCH` | `/api/v1/namespaces/:id` | Update |
| `DELETE` | `/api/v1/namespaces/:id` | Delete |
| `POST` | `/api/v1/evaluate` | `{ project_id, namespace?, flag? }` → `{ namespace, flag, value }` |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml). Catalog mirror: [`docs/services/config_manager.md`](../../docs/services/config_manager.md).

## SDK / CLI

- **SDK (Node):** `client.config.get(projectId)` lists namespaces; `client.config.evaluate(projectId, { namespace, flag })`. Generic CRUD: `client.resource('config_manager', 'namespaces')`.
- **CLI:** `aerekos config_manager namespaces list|get|create|update|delete --project $PID` (and `-d` JSON for create/update). Evaluate via SDK or `curl` to `/api/v1/evaluate` (no dedicated CLI verb yet).

## Quick start

```bash
cd worker/config_manager
npm install   # use Node 20 (.nvmrc)
npm start
# curl http://localhost:3136/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | `ItemService` ensureDefaults / evaluate |
| Integration | `npm run test:integration` | supertest against exported app |
| All | `npm test` | unit + integration |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | proxy + root `e2e/catalog.js` CRUD |

## Related

- Conductor registration / proxy
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

# vector_manager

**AWS analog:** OpenSearch kNN · **Port:** `3152`

Project-scoped **vector indexes** (CRUD metadata) plus `POST /api/v1/upsert` / `POST /api/v1/query`. Default dataplane is a **SQLite cosine sidecar** (`.vectors` next to `DATABASE_PATH`). When `CONDUCTOR_URL` is set, upsert/query prefer **db_manager** LanceDB vector APIs; query may also ask **ai_manager** for embeddings when `text`/`input` is supplied. This is a **facade**, not a second RAG stack.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Backend | Local SQLite cosine always works without conductor. Remote `db_manager` / `ai_manager` only when conductor proxy is reachable. |
| Indexes | CRUD records name/dim/backend metadata; they do **not** provision OpenSearch. |
| Prod mocks | None. Shared `assertNoSkipFakes()` via `createManagerApp`. |
| Tutorial | **none** — ManagerConsole lists “Vector Indexes” but has no `CONSOLE_GUIDES.vector_manager` / dedicated ServiceGuide. |

## Access

- Direct: `http://localhost:3152/...`
- Conductor proxy: `{VERB} {CONDUCTOR}/api/services/vector_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Service metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `rag` index if empty |
| `POST` | `/api/v1/indexes` | Create index (`project_id`, `name`, …) |
| `GET` | `/api/v1/indexes` | List (`?project_id=`) |
| `GET` | `/api/v1/indexes/:id` | Get one |
| `PATCH` | `/api/v1/indexes/:id` | Update |
| `DELETE` | `/api/v1/indexes/:id` | Delete |
| `POST` | `/api/v1/upsert` | Upsert vectors (`project_id`, `index?`, `items`/`rows`/`vector`) |
| `POST` | `/api/v1/query` | Nearest neighbors (`project_id`, `vector` or `text`, `top_k?`) |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/vector_manager.yaml`](../../docs/openapi/vector_manager.yaml). Catalog: [`docs/services/vector_manager.md`](../../docs/services/vector_manager.md).

## SDK / CLI

- **SDK:** `client.resource('vector_manager', 'indexes')` for CRUD. Upsert/query via `client.proxy('vector_manager', { method: 'POST', path: '/api/v1/upsert'|'/api/v1/query', … })` — no dedicated `client.vector` helper.
- **CLI:** `aerekos vector_manager indexes list|get|create|update|delete --project $PID`. Upsert/query: `aerekos call` or curl.

## Quick start

```bash
cd worker/vector_manager
npm install   # Node 20
npm start
# curl http://localhost:3152/health
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Integration | `npm run test:integration` | health/ready + indexes CRUD + local upsert/query |
| All | `npm test` | same (no separate unit suite yet) |
| Live e2e | [`tests/e2e/README.md`](./tests/e2e/README.md) | needs conductor; root `e2e/catalog.js` indexes CRUD |

## Related

- `db_manager` LanceDB vector APIs (preferred when conductor is up)
- `ai_manager` embeddings (optional query path)
- Capabilities: `vector`, `embeddings`

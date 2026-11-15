# query_manager — Athena

> **Observability** · Implemented

Project-scoped SQL **query definitions** (CRUD) plus `POST /api/v1/sql` against a per-project **better-sqlite3** file. Athena / DuckDB lake query is a naming analog only — no AWS Athena client. `SKIP_DUCKDB` short-circuits `/sql` in tests/dev only (refused in production via `assertNoSkipFakes`). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry).

- **Port:** `3145`
- **AWS analog:** Athena
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/query_manager{path}` (JWT or service token)
- **Capabilities:** `athena`, `sql`
- **OpenAPI:** `worker/query_manager/api/openapi.yaml` (pack copy: `docs/openapi/query_manager.yaml`)
- **SDK/CLI:** `client.resource('query_manager', 'queries')`; CLI `aerekos query_manager queries …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed sample query if missing |
| `POST` | `/api/v1/sql` | Run SQL against per-project SQLite |
| `POST` | `/api/v1/queries` | Create a query ({ project_id, name, ... }) |
| `GET` | `/api/v1/queries` | List queries (?project_id=) |
| `GET` | `/api/v1/queries/:id` | Get one query |
| `PATCH` | `/api/v1/queries/:id` | Update a query |
| `DELETE` | `/api/v1/queries/:id` | Delete a query |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/query_manager/api/v1/queries?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","sql":"SELECT 1"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/query_manager/api/v1/sql" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","sql":"SELECT 1 AS n"}'
```

**SDK (Node)**

```js
const r = client.resource('query_manager', 'queries');
await r.create(PID, { name: 'demo', sql: 'SELECT 1' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos query_manager queries create --project $PID --data '{"name":"demo","sql":"SELECT 1"}'
aerekos query_manager queries list --project $PID
aerekos call query_manager POST "/api/v1/sql" --project $PID --data '{"sql":"SELECT 1 AS n"}'
```

---

_Hand-aligned with `worker/query_manager` for Wave 6 closeout honesty. Catalog CRUD + `/sql` also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

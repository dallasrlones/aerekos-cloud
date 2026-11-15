# search_manager — OpenSearch

> **Database** · Implemented

Search index records (name/engine/prefix) plus `ensure-defaults`, FTS5 `index` ingest, and `query` (real hits; `{ empty: true }` only when the index has no docs). No production mocks (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone — generic ManagerConsole (no dedicated SearchManager ServiceGuide). Live conductor e2e parked. Not a full OpenSearch cluster.

- **Port:** `3144`
- **AWS analog:** OpenSearch
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/search_manager{path}` (JWT or service token)
- **Capabilities:** `search`, `fts`
- **OpenAPI:** `worker/search_manager/api/openapi.yaml` (pack copy: `docs/openapi/search_manager.yaml`)
- **SDK/CLI:** generic `client.resource('search_manager', 'indexes')` / `client.proxy`; CLI `aerekos search_manager indexes …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `docs` index if missing |
| `POST` | `/api/v1/index` | Index documents into FTS5 |
| `POST` | `/api/v1/query` | FTS query → `{ hits }` |
| `POST` | `/api/v1/indexes` | Create an index ({ project_id, name, ... }) |
| `GET` | `/api/v1/indexes` | List indexes (?project_id=) |
| `GET` | `/api/v1/indexes/:id` | Get one index |
| `PATCH`/`PUT` | `/api/v1/indexes/:id` | Update an index |
| `DELETE` | `/api/v1/indexes/:id` | Delete an index |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/search_manager/api/v1/indexes?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/search_manager/api/v1/index" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","index":"demo","title":"Hello","body":"widgets"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/search_manager/api/v1/query" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","index":"demo","q":"widgets"}'
```

**SDK (Node)**

```js
const r = client.resource('search_manager', 'indexes');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos search_manager indexes create --project $PID --data '{"name":"demo"}'
aerekos search_manager indexes list --project $PID
```

---

_Hand-aligned with `worker/search_manager` for Wave 6 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

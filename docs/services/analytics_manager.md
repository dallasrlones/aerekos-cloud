# analytics_manager — Pinpoint / Kinesis Analytics

> **Observability** · Implemented

Product analytics events (`event` / `value` / `properties`) plus in-process query-on-storage (SQLite over loaded rows; DuckDB naming analog only — no AWS Pinpoint/Kinesis client). **Tutorial / ServiceGuide:** none (no `CONSOLE_GUIDES.analytics_manager`; generic Observability ManagerConsole only). No production mocks — `assertNoSkipFakes` refuses shared skip flags and `SKIP_DUCKDB` when `NODE_ENV=production`; tests use temp SQLite + `SKIP_SERVICE_REGISTRATION`.

- **Port:** `3117`
- **AWS analog:** Pinpoint / Kinesis Analytics
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/analytics_manager{path}` (JWT or service token)
- **Capabilities:** `analytics`, `events`
- **OpenAPI:** `worker/analytics_manager/api/openapi.yaml` (pack copy: `docs/openapi/analytics_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/events` | Create an event ({ project_id, name, ... }) |
| `GET` | `/api/v1/events` | List events (?project_id=) |
| `GET` | `/api/v1/events/:id` | Get one event |
| `PATCH` | `/api/v1/events/:id` | Update an event |
| `DELETE` | `/api/v1/events/:id` | Delete an event |
| `POST` | `/api/v1/query-on-storage` | SELECT over loaded events (SQLite engine) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/analytics_manager/api/v1/events?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","event":"ui.click"}'
```

**SDK (Node)**

```js
const r = client.resource('analytics_manager', 'events');
await r.create(PID, { name: 'demo', event: 'ui.click' });
console.log(await r.list(PID));
```

No dedicated `client.analytics` helper.

**CLI**

```bash
aerekos call analytics_manager POST "/api/v1/events" --project $PID --data '{"name":"demo","event":"ui.click"}'
aerekos call analytics_manager GET "/api/v1/events?project_id=$PID"
```

No dedicated `aerekos analytics` subcommand.

---

_Hand-aligned with `worker/analytics_manager` for Wave 4 closeout honesty. Catalog extras live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

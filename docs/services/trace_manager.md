# trace_manager — X-Ray

> **Observability** · Implemented

OTLP/HTTP ingest (`POST /v1/traces`) plus span list/query and trace metadata CRUD in SQLite. Not a full X-Ray / Jaeger / Tempo cluster. No production mocks (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial / ServiceGuide:** none (generic ManagerConsole). Live conductor e2e parked.

- **Port:** `3143`
- **AWS analog:** X-Ray
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/trace_manager{path}` (JWT or service token)
- **Capabilities:** `tracing`
- **OpenAPI:** `worker/trace_manager/api/openapi.yaml` (pack copy: `docs/openapi/trace_manager.yaml`)
- **SDK/CLI:** `client.resource('trace_manager', 'traces')` / `client.proxy('trace_manager', …)`; CLI `aerekos call trace_manager …`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed sample trace if missing |
| `POST` | `/v1/traces` | OTLP HTTP ingest |
| `GET` | `/api/v1/spans` | List stored spans |
| `GET` | `/api/v1/query` | Query spans |
| `POST` | `/api/v1/traces` | Create a trace ({ project_id, name, ... }) |
| `GET` | `/api/v1/traces` | List traces (?project_id=) |
| `GET` | `/api/v1/traces/:id` | Get one trace |
| `PATCH` | `/api/v1/traces/:id` | Update a trace |
| `DELETE` | `/api/v1/traces/:id` | Delete a trace |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/trace_manager/api/v1/traces?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('trace_manager', 'traces');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos call trace_manager POST "/api/v1/traces" --project $PID --data '{"name":"demo"}'
aerekos call trace_manager GET "/api/v1/traces" --project $PID
```

---

_Hand-aligned with `worker/trace_manager` for Wave 7 closeout honesty. Catalog endpoints live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

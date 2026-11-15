# logs_manager — CloudWatch Logs

> **Observability** · Implemented

Append-only log events with levels and context. Batch ingest for the worker outbox/shipper. Query filters: `level`, `source`, `q`, `since`, `until`, `limit`. Compact by retention days. No production mocks (`assertNoSkipFakes()`). **Tutorial / ServiceGuide:** ManagerConsole `CONSOLE_GUIDES.logs_manager`.

- **Port:** `3104`
- **AWS analog:** CloudWatch Logs
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/logs_manager{path}` (JWT or service token)
- **Capabilities:** `logs`, `ingest`
- **OpenAPI:** `worker/logs_manager/api/openapi.yaml` (pack copy: `docs/openapi/logs_manager.yaml`)
- **SDK/CLI:** generic `client.proxy('logs_manager', …)`; CLI `aerekos call logs_manager …`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/logs` | Append a log event |
| `POST` | `/api/v1/logs/batch` | Batch append (outbox shipper) |
| `GET` | `/api/v1/logs` | Query logs (level, source, q, since, until, limit) |
| `GET` | `/api/v1/logs/:id` | Get a log event |
| `DELETE` | `/api/v1/logs/:id` | Delete a log event |
| `POST` | `/api/v1/logs/compact` | Drop rows older than retention days |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/logs_manager/api/v1/logs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","level":"info","message":"hello","source":"demo"}'
```

**SDK (Node)**

```js
await client.proxy('logs_manager', {
  method: 'POST',
  path: '/api/v1/logs',
  projectId: PID,
  body: { level: 'info', message: 'hello', source: 'demo' },
});
```

**CLI**

```bash
aerekos call logs_manager POST "/api/v1/logs" --project $PID --data '{"level":"info","message":"hello"}'
```

---

_Hand-aligned with `worker/logs_manager` for Wave 5 closeout honesty. Catalog endpoints live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

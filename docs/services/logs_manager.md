# logs_manager — CloudWatch Logs

> **Observability** · Implemented

Append-only log events with levels and context. Batch ingest for the worker outbox/shipper.

- **Port:** `3104`
- **AWS analog:** CloudWatch Logs
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/logs_manager{path}` (JWT or service token)
- **Capabilities:** `logs`, `ingest`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/logs` | Append a log event |
| `POST` | `/api/v1/logs/batch` | Batch append (outbox shipper) |
| `GET` | `/api/v1/logs` | Query logs (level, since, limit) |
| `GET` | `/api/v1/logs/:id` | Get a log event |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/logs_manager/api/v1/logs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('logs_manager', { method: 'POST', path: '/api/v1/logs', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call logs_manager POST "/api/v1/logs" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

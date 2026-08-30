# webhook_manager — EventBridge / SNS (HTTP)

> **Integrations** · Implemented

Outbound webhooks: endpoints with secret + headers, and a dispatch action. SKIP_OUTBOUND=1 to avoid network.

- **Port:** `3112`
- **AWS analog:** EventBridge / SNS (HTTP)
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/webhook_manager{path}` (JWT or service token)
- **Capabilities:** `webhooks`, `fanout`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/webhooks` | Create an endpoint ({ name, target_url }) |
| `GET` | `/api/v1/webhooks` | List endpoints |
| `GET` | `/api/v1/webhooks/:id` | Get an endpoint |
| `PATCH` | `/api/v1/webhooks/:id` | Update an endpoint |
| `DELETE` | `/api/v1/webhooks/:id` | Delete an endpoint |
| `POST` | `/api/v1/webhooks/:id/dispatch` | Send a payload to the endpoint |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_OUTBOUND` | `0` | Record but do not send (tests) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/webhook_manager/api/v1/webhooks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('webhook_manager', { method: 'POST', path: '/api/v1/webhooks', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call webhook_manager POST "/api/v1/webhooks" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

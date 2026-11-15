# webhook_manager — EventBridge / SNS (HTTP)

> **Integrations** · Implemented

Outbound webhook endpoints (`name`/`target_url`/optional secret+headers) plus `dispatch` and delivery history. `SKIP_OUTBOUND=1` records skipped deliveries without HTTP (tests/dev only). Production refuses `SKIP_OUTBOUND` / skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). Not an inbound receiver. **Tutorial:** none standalone — generic ManagerConsole (no dedicated ServiceGuide). Live conductor e2e parked.

- **Port:** `3112`
- **AWS analog:** EventBridge / SNS (HTTP)
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/webhook_manager{path}` (JWT or service token)
- **Capabilities:** `webhooks`, `fanout`
- **OpenAPI:** `worker/webhook_manager/api/openapi.yaml` (pack copy: `docs/openapi/webhook_manager.yaml`)
- **SDK/CLI:** generic `client.proxy('webhook_manager', …)`; CLI `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/webhooks` | Create an endpoint ({ project_id, name, target_url }) |
| `GET` | `/api/v1/webhooks` | List endpoints (?project_id=) |
| `GET` | `/api/v1/webhooks/:id` | Get an endpoint |
| `PATCH`/`PUT` | `/api/v1/webhooks/:id` | Update an endpoint |
| `DELETE` | `/api/v1/webhooks/:id` | Delete an endpoint |
| `POST` | `/api/v1/webhooks/:id/dispatch` | Send a payload (`mode: skip\|live`) |
| `GET` | `/api/v1/webhooks/:id/deliveries` | Delivery history |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_OUTBOUND` | unset | Record but do not send (tests/dev; forbidden in production) |
| `WEBHOOK_HTTP_TIMEOUT_MS` | `15000` | Live dispatch timeout |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/webhook_manager/api/v1/webhooks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","target_url":"https://example.com/hook"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/webhook_manager/api/v1/webhooks/$WID/dispatch" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","hello":"world"}'
```

**SDK (Node)**

```js
await client.proxy('webhook_manager', {
  method: 'POST',
  path: '/api/v1/webhooks',
  projectId: PID,
  body: { name: 'demo', target_url: 'https://example.com/hook' },
});
```

**CLI**

```bash
aerekos call webhook_manager POST "/api/v1/webhooks" --project $PID --data '{"name":"demo","target_url":"https://example.com/hook"}'
```

---

_Hand-aligned with `worker/webhook_manager` for Wave 8 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

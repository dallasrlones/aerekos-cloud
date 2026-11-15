# event_manager — EventBridge

> **Integrations** · Implemented

Project-scoped event buses, rules, and put-event fan-out. `ensure-defaults` seeds `default` + `aerekos.fleet`. `email`/`sms`/`slack` targets always skipped (`outbound_disabled`); `push` skips under `SKIP_OUTBOUND` (test/dev only). **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_OUTBOUND` mocks.

- **Port:** `3132`
- **AWS analog:** EventBridge
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/event_manager{path}` (JWT or service token)
- **Capabilities:** `events`, `bus`
- **OpenAPI:** `worker/event_manager/api/openapi.yaml` (pack copy: `docs/openapi/event_manager.yaml`)
- **SDK/CLI:** `client.resource('event_manager', 'buses')`; CLI `aerekos event_manager buses …` / `aerekos call`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default + aerekos.fleet buses |
| `POST` | `/api/v1/events` | Put event → 202 `{ event, deliveries }` |
| `POST` | `/api/v1/rules` | Create a rule |
| `GET` | `/api/v1/rules` | List rules (?project_id= / bus_id) |
| `POST` | `/api/v1/buses` | Create a bus ({ project_id, name, ... }) |
| `GET` | `/api/v1/buses` | List buses (?project_id=) |
| `GET` | `/api/v1/buses/:id` | Get one bus |
| `PATCH` | `/api/v1/buses/:id` | Update a bus |
| `DELETE` | `/api/v1/buses/:id` | Delete a bus |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/event_manager/api/v1/buses?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'

curl -s -X POST \
  "$CONDUCTOR/api/services/event_manager/api/v1/events" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","type":"ping","payload":{"ok":true}}'
```

**SDK (Node)**

```js
const r = client.resource('event_manager', 'buses');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos event_manager buses create --project $PID --data '{"name":"demo"}'
aerekos event_manager buses list --project $PID
aerekos call event_manager POST "/api/v1/events" --project $PID --data '{"type":"ping"}'
```

---

_Hand-aligned with `worker/event_manager` for Wave 5 closeout honesty. Catalog CRUD + events/rules also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

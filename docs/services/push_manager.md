# push_manager — SNS mobile

> **Integrations** · Implemented

Push subscriptions. Queued; outbound send disabled.

- **Port:** `3153`
- **AWS analog:** SNS mobile
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/push_manager{path}` (JWT or service token)
- **Capabilities:** `push`

> ⚠️ **Provider activation:** Queued only this pass. Do not retry live FCM send.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/subscriptions` | Create a subscription ({ project_id, name, ... }) |
| `GET` | `/api/v1/subscriptions` | List subscriptions (?project_id=) |
| `GET` | `/api/v1/subscriptions/:id` | Get one subscription |
| `PATCH` | `/api/v1/subscriptions/:id` | Update a subscription |
| `DELETE` | `/api/v1/subscriptions/:id` | Delete a subscription |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/push_manager/api/v1/subscriptions?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('push_manager', 'subscriptions');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos push_manager subscriptions create --project $PID --data '{"name":"demo"}'
aerekos push_manager subscriptions list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

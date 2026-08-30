# auth_manager — Cognito

> **Identity** · Implemented · needs provider keys for live calls

OIDC provider metadata (issuer/client_id/config). Keep client_secret in secrets_manager.

- **Port:** `3116`
- **AWS analog:** Cognito
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/auth_manager{path}` (JWT or service token)
- **Capabilities:** `oidc`, `identity-providers`

> ⚠️ **Provider activation:** OIDC client_secret (store in secrets_manager) to complete real auth flows.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/providers` | Create a provider ({ project_id, name, ... }) |
| `GET` | `/api/v1/providers` | List providers (?project_id=) |
| `GET` | `/api/v1/providers/:id` | Get one provider |
| `PATCH` | `/api/v1/providers/:id` | Update a provider |
| `DELETE` | `/api/v1/providers/:id` | Delete a provider |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/auth_manager/api/v1/providers?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('auth_manager', 'providers');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos auth_manager providers create --project $PID --data '{"name":"demo"}'
aerekos auth_manager providers list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

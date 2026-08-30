# cert_manager — ACM

> **Identity** · Implemented

Import PEM or mint self-signed certificates. No Let's Encrypt.

- **Port:** `3137`
- **AWS analog:** ACM
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cert_manager{path}` (JWT or service token)
- **Capabilities:** `certs`, `tls`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/certs` | Create a cert ({ project_id, name, ... }) |
| `GET` | `/api/v1/certs` | List certs (?project_id=) |
| `GET` | `/api/v1/certs/:id` | Get one cert |
| `PATCH` | `/api/v1/certs/:id` | Update a cert |
| `DELETE` | `/api/v1/certs/:id` | Delete a cert |
| `POST` | `/api/v1/certs/mint` | Mint a self-signed PEM |
| `POST` | `/api/v1/certs/import` | Import a PEM bundle |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/cert_manager/api/v1/certs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('cert_manager', 'certs');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos cert_manager certs create --project $PID --data '{"name":"demo"}'
aerekos cert_manager certs list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

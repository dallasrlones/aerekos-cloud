# cluster_manager — EKS

> **Compute** · Implemented

Detect k3s on the worker host. Install only on explicit confirm — never auto-install on prod.

- **Port:** `3151`
- **AWS analog:** EKS
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cluster_manager{path}` (JWT or service token)
- **Capabilities:** `k8s`, `k3s`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/clusters` | Create a cluster ({ project_id, name, ... }) |
| `GET` | `/api/v1/clusters` | List clusters (?project_id=) |
| `GET` | `/api/v1/clusters/:id` | Get one cluster |
| `PATCH` | `/api/v1/clusters/:id` | Update a cluster |
| `DELETE` | `/api/v1/clusters/:id` | Delete a cluster |
| `GET` | `/api/v1/clusters/:id/k3s/status` | Detect k3s on the host |
| `POST` | `/api/v1/clusters/:id/k3s/install` | Install k3s only if { confirm: true } |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/cluster_manager/api/v1/clusters?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('cluster_manager', 'clusters');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos cluster_manager clusters create --project $PID --data '{"name":"demo"}'
aerekos cluster_manager clusters list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

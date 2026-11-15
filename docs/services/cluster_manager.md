# cluster_manager — EKS

> **Compute** · Implemented

Docker fleet inventory on the **worker host**. Optional k3s detect/install only on explicit `{ confirm: true }` — never auto-install. EKS is a naming analog only (no AWS EKS client). **Tutorial / ServiceGuide:** none (ManagerConsole has no dedicated `CONSOLE_GUIDES` entry). No production mocks — `SKIP_HOST_PATCH` is test/dev only.

- **Port:** `3151`
- **AWS analog:** EKS
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/cluster_manager{path}` (JWT or service token)
- **Capabilities:** `k8s`, `k3s`, `docker`
- **OpenAPI:** `worker/cluster_manager/api/openapi.yaml` (pack copy: `docs/openapi/cluster_manager.yaml`)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed default `k3s` cluster if empty |
| `POST` | `/api/v1/clusters` | Create a cluster ({ project_id, name, ... }) |
| `GET` | `/api/v1/clusters` | List clusters (?project_id=) |
| `GET` | `/api/v1/clusters/:id` | Get one cluster |
| `PATCH` | `/api/v1/clusters/:id` | Update a cluster |
| `DELETE` | `/api/v1/clusters/:id` | Delete a cluster |
| `GET` | `/api/v1/clusters/:id/fleet` | List docker containers on this host |
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

No dedicated `client.cluster` helper.

**CLI**

```bash
aerekos call cluster_manager POST "/api/v1/clusters" --project $PID --data '{"name":"demo"}'
aerekos call cluster_manager GET "/api/v1/clusters?project_id=$PID"
```

No dedicated `aerekos cluster` subcommand.

---

_Hand-aligned with `worker/cluster_manager` for Wave 2 closeout honesty. Catalog extras also live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

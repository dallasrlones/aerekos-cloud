# network_manager — VPC

> **Compute** · Implemented

Per-project Docker bridge networks with stable names. Attach service containers for isolation. Optional Headscale mesh helpers. No production mocks (`SKIP_DOCKER` refused in prod). **Tutorial:** none.

- **Port:** `3103`
- **AWS analog:** VPC
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/network_manager{path}` (JWT or service token)
- **Capabilities:** `networking`, `docker-networks`
- **OpenAPI:** `worker/network_manager/api/openapi.yaml` (pack copy: `docs/openapi/network_manager.yaml`)
- **SDK/CLI:** generic `client.proxy` / `client.resource('network_manager', 'networks')`; CLI `aerekos call network_manager …` (no typed `client.network` or dedicated `aerekos network` yet)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/networks` | Create a network (bridge only) |
| `GET` | `/api/v1/networks` | List networks (`?project_id=`) |
| `GET` | `/api/v1/networks/:id` | Get a network |
| `DELETE` | `/api/v1/networks/:id` | Delete a network |
| `POST` | `/api/v1/networks/ensure-default` | Ensure logical `default` |
| `GET` | `/api/v1/mesh` | Mesh status |
| `POST` | `/api/v1/mesh/preauth` | Mint preauth key |
| `POST` | `/api/v1/mesh/preauth/:id/revoke` | Revoke preauth |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_DOCKER` | `0` | Metadata-only mode (**tests only**; prod guard refuses) |
| `HEADSCALE_URL` | — | Enables mesh status / remote mint |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/network_manager/api/v1/networks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const nets = client.resource('network_manager', 'networks');
await nets.create(PID, { name: 'demo' });
console.log(await nets.list(PID));
// or generic proxy:
await client.proxy('network_manager', { method: 'POST', path: '/api/v1/networks', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call network_manager POST "/api/v1/networks" --project $PID --data '{"name":"demo"}'
```

---

_Wave 2 closeout for `mgr-network_manager`: health/proxy honesty, OpenAPI pack, SDK/CLI generic surfaces, tutorial none, no prod mocks. Live conductor proxy e2e parked until stack is up._

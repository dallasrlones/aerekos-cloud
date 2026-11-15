# balancer_manager — ELB

> **Edge** · Implemented

Load-balancer target hints (addresses) with optional HTTP health probes. No cloud LB provisioning in MVP. No production mocks (`SKIP_HEALTH` / `SKIP_DOCKER` refused in prod). **Tutorial:** none.

- **Port:** `3109`
- **AWS analog:** ELB
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/balancer_manager{path}` (JWT or service token)
- **Capabilities:** `load-balancing`, `targets`
- **OpenAPI:** `worker/balancer_manager/api/openapi.yaml` (pack copy: `docs/openapi/balancer_manager.yaml`)
- **SDK/CLI:** typed `client.balancer` (`list`, `create`, `health`, `remove`); also generic `client.resource` / `client.proxy`; CLI `aerekos call balancer_manager …`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/targets` | Create a target ({ project_id, name, address?, … }) |
| `GET` | `/api/v1/targets` | List targets (?project_id=) |
| `GET` | `/api/v1/targets/:id` | Get one target |
| `PATCH` | `/api/v1/targets/:id` | Update a target |
| `DELETE` | `/api/v1/targets/:id` | Delete a target |
| `GET` | `/api/v1/targets/health` | Probe health (optional `?pool=`) |
| `GET` | `/api/v1/targets/:id/health` | Probe one target |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_HEALTH` | `0` | Skip live probes (**tests only**; prod guard refuses) |
| `SKIP_DOCKER` | `0` | Shared skip flag (**tests only**; prod guard refuses) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/balancer_manager/api/v1/targets?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","address":"http://10.0.0.9:8080"}'
```

**SDK (Node)**

```js
await client.balancer.create(PID, { name: 'demo', address: 'http://10.0.0.9:8080' });
console.log(await client.balancer.list(PID));
console.log(await client.balancer.health(PID));
```

**CLI**

```bash
aerekos call balancer_manager POST "/api/v1/targets" --project $PID --data '{"name":"demo","address":"http://10.0.0.9:8080"}'
aerekos call balancer_manager GET "/api/v1/targets" --project $PID
```

---

_Wave 4 closeout for `mgr-balancer_manager`: health/proxy honesty, OpenAPI pack, SDK/CLI surfaces, tutorial none, no prod mocks. Live conductor proxy e2e parked until stack is up._

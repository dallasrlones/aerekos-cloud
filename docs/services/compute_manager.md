# compute_manager — Kubernetes (aerekos Compute)

> **Compute** · Implemented

aerekos Compute orchestrator: project-scoped tasks (dockerode) plus declarative Deployments (rolling update / pause / resume / rollback). No production mocks — `SKIP_DOCKER` is tests/local only and refused when `NODE_ENV=production`. **Tutorial:** none.

- **Port:** `3100`
- **AWS analog:** Kubernetes (aerekos Compute)
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/compute_manager{path}` (JWT or service token)
- **Health/proxy:** `/health` + `/ready` (also via proxy `/api/services/compute_manager/health`); skip `projectId`
- **Capabilities:** `deployments`, `containers`, `tasks`, `docker`, `orchestrator`
- **OpenAPI:** `worker/compute_manager/api/openapi.yaml` (pack copy: `docs/openapi/compute_manager.yaml`)
- **Mocks:** `SKIP_DOCKER` for CI/supertest only; boot `assertNoSkipFakes()` exits in production if set

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness (SQLite) |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/tasks` | Create a task |
| `GET` | `/api/v1/tasks` | List tasks (`?refresh=1` to reconcile) |
| `GET` | `/api/v1/tasks/:id` | Get a task |
| `POST` | `/api/v1/tasks/:id/stop` | Stop a task |
| `DELETE` | `/api/v1/tasks/:id` | Delete a task |
| `PUT` | `/api/v1/deployments/:id` | Apply declarative Deployment |
| `GET` | `/api/v1/deployments/:id` | Get Deployment + status |
| `POST` | `/api/v1/deployments/:id/reconcile` | Reconcile once |
| `POST` | `/api/v1/deployments/:id/pause` | Pause rollout |
| `POST` | `/api/v1/deployments/:id/resume` | Resume rollout |
| `POST` | `/api/v1/deployments/:id/rollback` | Rollback to revision |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_DOCKER` | `0` | Metadata-only / mock container ids — **tests only**; refused in production |
| `COMPUTE_E2E_DOCKER` | `0` | Enable dockerode apply in reconcile e2e |

## SDK / CLI

**SDK (Node)**

```js
await client.compute.create(PID, { name: 'demo', image: 'alpine:3.19', command: ['sh', '-c', 'echo ok'] });
console.log(await client.compute.list(PID));
await client.compute.remove(PID, taskId);
// Deployments — generic proxy
await client.proxy('compute_manager', {
  method: 'PUT', path: `/api/v1/deployments/${id}`, projectId: PID, body: { /* DeploymentApply */ },
});
```

**CLI**

```bash
aerekos call compute_manager POST "/api/v1/tasks" --project $PID \
  --data '{"project_id":"'"$PID"'","name":"demo","image":"alpine:3.19"}'
```

No dedicated `aerekos compute …` verbs yet.

## Tutorial / ServiceGuide

**Tutorial: none.** Console **ComputeManager** screen exists (`conductor/app/screens/ComputeManager`); no standalone tutorial under `docs/tutorials`.

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/compute_manager/api/v1/tasks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","image":"alpine:3.19"}'
```

---

_Hand-aligned with `worker/compute_manager` for Wave 2 closeout honesty. Catalog also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

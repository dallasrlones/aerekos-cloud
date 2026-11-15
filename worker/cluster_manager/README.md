# cluster_manager

**AWS analog:** EKS · **Port:** `3151`

Project-scoped **cluster** records (name + optional `kubeconfig` / `status`) plus host-local Docker fleet inventory and optional k3s detect/install. SQLite via `aerekos-record`. Shared `assertNoSkipFakes()` rejects skip/fake env in production.

## Status / honesty

| Claim | Reality |
|-------|---------|
| CRUD | Real SQLite clusters via `/api/v1/clusters` |
| Fleet | `GET .../fleet` runs `docker ps` on the **worker host** (not a remote EKS control plane). With `SKIP_HOST_PATCH=1` returns empty/`skipped` (tests). |
| k3s | Detect looks for local `k3s`/`kubectl` binaries. Install requires `{ confirm: true }` and runs `nsenter` + get.k3s.io — **never auto-install**. `SKIP_HOST_PATCH` skips exec. |
| EKS | Naming analog only — no AWS EKS API client |
| Prod mocks | No fake clusters in prod. Skip flags are test/dev only. |
| Tutorial | **None** — no dedicated ServiceGuide copy in ManagerConsole (`CONSOLE_GUIDES`); no standalone tutorial |

## Access

- Direct: `http://localhost:3151/...`
- Conductor proxy: `{CONDUCTOR}/api/services/cluster_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, aws `EKS`) |
| `POST` | `/api/v1/ensure-defaults` | Seed default `k3s` cluster if empty |
| `POST` | `/api/v1/clusters` | Create (`project_id`, `name`, …) |
| `GET` | `/api/v1/clusters` | List (`?project_id=`) |
| `GET` | `/api/v1/clusters/:id` | Get one |
| `PATCH` | `/api/v1/clusters/:id` | Update |
| `DELETE` | `/api/v1/clusters/:id` | Delete |
| `GET` | `/api/v1/clusters/:id/fleet` | Docker containers on this host |
| `GET` | `/api/v1/clusters/:id/k3s/status` | Detect k3s/kubectl on host |
| `POST` | `/api/v1/clusters/:id/k3s/install` | Install only if `{ confirm: true }` |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/cluster_manager.yaml`](../../docs/openapi/cluster_manager.yaml). Catalog: [`docs/services/cluster_manager.md`](../../docs/services/cluster_manager.md).

## SDK / CLI

- **SDK (Node):** generic CRUD `client.resource('cluster_manager', 'clusters')`. No dedicated `client.cluster` helper.
- **CLI:** generic `aerekos call` / resource verbs — no dedicated `aerekos cluster` subcommand.

```bash
aerekos call cluster_manager POST "/api/v1/clusters" --project $PID --data '{"name":"demo"}'
aerekos call cluster_manager GET "/api/v1/clusters?project_id=$PID"
```

## Quick start

```bash
cd worker/cluster_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3151/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3151` | Listen port |
| `DATABASE_PATH` | `data/cluster_manager.db` | SQLite file |
| `SKIP_HOST_PATCH` | unset | `1` skips docker/k3s host exec (tests) |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | K3sHost confirm + SKIP_HOST_PATCH; ensureDefaults |
| Integration | `npm run test:integration` | health/ready/info + CRUD + k3s/fleet with skip |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked without stack; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3151`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

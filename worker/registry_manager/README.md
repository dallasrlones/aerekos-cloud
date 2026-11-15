# registry_manager

**AWS analog:** ECR · **Port:** `3129`

Per-project **registry** metadata (CRUD `/api/v1/registries` — no pull secrets), public config hints, npm/pypi/docker **artifacts**, **wanted** image pull windows, and project-scoped image picker. SQLite via `aerekos-record`. Shared `assertNoSkipFakes()` refuses `SKIP_DOCKER` (and related skip flags) when `NODE_ENV=production`.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Registry CRUD | Real SQLite entries; passwords never stored or echoed — use `credential_ref` + `secrets_manager` / host `docker login` |
| Public config | `GET /api/v1/registry/config` — mode/URL/namespace labels only |
| Inventory / import | Host `docker images` / `docker load` unless `SKIP_DOCKER=1` (tests) |
| Wanted run-now | `docker pull` unless skipped |
| Project images | Wanted + docker artifacts (+ local `aer-cmp-*` builds); not a dump of host compose images |
| ECR | Naming analog only — no AWS ECR client |
| Prod mocks | Skip flags are test/dev only |
| Tutorial | **None** — console **RegistryManager** (IntegrationHub) has no ServiceGuide; no standalone tutorial |

## Access

- Direct: `http://localhost:3129/...`
- Conductor proxy: `{CONDUCTOR}/api/services/registry_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `GET` | `/api/v1/registry/config` | Public registry hints (no secrets) |
| `POST` | `/api/v1/registries` | Create entry (`project_id`, `name`, `registry_url`, …) |
| `GET` | `/api/v1/registries` | List (`?project_id=`) |
| `GET` | `/api/v1/registries/:id` | Get one |
| `PATCH` | `/api/v1/registries/:id` | Update |
| `DELETE` | `/api/v1/registries/:id` | Delete |
| `GET` | `/api/v1/artifacts` | List artifacts (`?project_id=`, optional `kind`) |
| `POST` | `/api/v1/artifacts` | Create artifact (`docker` / `npm` / `pypi`) |
| `GET` | `/api/v1/wanted` | List wanted images |
| `POST` | `/api/v1/wanted` | Create wanted image |
| `PATCH` | `/api/v1/wanted/:id` | Update |
| `DELETE` | `/api/v1/wanted/:id` | Delete |
| `POST` | `/api/v1/wanted/:id/run-now` | Pull now (or skip under `SKIP_DOCKER`) |
| `GET` | `/api/v1/images/project` | Project-scoped image picker |
| `POST` | `/api/v1/images/import` | `docker load -i` tar (or skip) |
| `GET` | `/api/v1/inventory` | Host `docker images` inventory |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/registry_manager.yaml`](../../docs/openapi/registry_manager.yaml). Catalog: [`docs/services/registry_manager.md`](../../docs/services/registry_manager.md). Integration story: [`REGISTRY.md`](./REGISTRY.md).

## SDK / CLI

- **SDK (Node):** generic `client.resource('registry_manager', 'registries')` or `client.proxy('registry_manager', …)`. No dedicated `client.registry` helper.
- **CLI:** `aerekos call registry_manager …` — no dedicated `aerekos registry` subcommand.

```bash
aerekos call registry_manager POST "/api/v1/registries" --project $PID --data '{"name":"demo","registry_url":"harbor.example.com"}'
aerekos call registry_manager GET "/api/v1/registry/config"
```

## Quick start

```bash
cd worker/registry_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3129/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3129` | Listen port |
| `DATABASE_PATH` | local SQLite | Test setup uses temp DB |
| `REGISTRY_MODE` | `local` | Label only (`local`/`docker_hub`/`harbor`/`embedded`/`custom`) |
| `REGISTRY_PUBLIC_BASE_URL` | empty | Display URL |
| `REGISTRY_DEFAULT_NAMESPACE` | empty | Display namespace |
| `REGISTRY_AUTH_EXPECTED` | unset | Hint that workers need `docker login` |
| `SKIP_DOCKER` | unset | `1` skips host docker exec (tests) |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Public config + `inWindow` |
| Integration | `npm run test:integration` | health/ready/info, config, registries CRUD, images |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Parked without stack; root `e2e/catalog.js` / `e2e/wave2-registry.js` |

## Related

- Conductor seed / `managerServicePorts` → `3129`
- Worker `ServiceManager.pullImage` uses conductor `docker_image` as-is
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

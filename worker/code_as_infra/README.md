# code_as_infra

**AWS analog:** CloudFormation · **Port:** `3120`

Project-scoped **IaC modules / snippets** (CRUD `/api/v1/modules` with `kind` + `content`). SQLite via `aerekos-record`. Actual apply/plan is **out of scope** for this MVP — stack revision APIs on the conductor are the preferred single writer for live infra (see redundancy notes). Catalog maturity: **experimental**.

## Status / honesty

| Claim | Reality |
|-------|---------|
| Modules CRUD | Real SQLite via `/api/v1/modules` |
| Apply / plan | **Not implemented** — storage only |
| CloudFormation | Naming analog only — no AWS CFN client |
| Prod mocks | None. `SKIP_SERVICE_REGISTRATION` is test/dev only |
| Tutorial / ServiceGuide | **None** |

## Access

- Direct: `http://localhost:3120/...`
- Conductor proxy: `{CONDUCTOR}/api/services/code_as_infra{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`, aws `CloudFormation`) |
| `POST` | `/api/v1/modules` | Create (`project_id`, `name`, optional `kind`/`content`) |
| `GET` | `/api/v1/modules` | List (`?project_id=`) |
| `GET` | `/api/v1/modules/:id` | Get one |
| `PATCH` / `PUT` | `/api/v1/modules/:id` | Update |
| `DELETE` | `/api/v1/modules/:id` | Delete |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/code_as_infra.yaml`](../../docs/openapi/code_as_infra.yaml). Catalog: [`docs/services/code_as_infra.md`](../../docs/services/code_as_infra.md).

## SDK / CLI

- **SDK (Node):** generic CRUD `client.resource('code_as_infra', 'modules')`. No dedicated helper.
- **CLI:** resource verbs or `aerekos call` — no dedicated `aerekos code_as_infra` subcommand required for closeout.

```bash
aerekos call code_as_infra POST "/api/v1/modules" --project $PID --data '{"name":"demo","kind":"json","content":"{}"}'
aerekos call code_as_infra GET "/api/v1/modules?project_id=$PID"
```

## Quick start

```bash
cd worker/code_as_infra
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3120/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3120` | Listen port |
| `DATABASE_PATH` | `data/code_as_infra.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | IaModuleService validation |
| Integration | `npm run test:integration` | health/ready/info + modules CRUD |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked without stack; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3120`
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

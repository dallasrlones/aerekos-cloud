# tunnel_manager

**AWS analog:** Cloudflare Tunnel · **Port:** `3110`

Project-scoped **Cloudflare Tunnel** (`cloudflared`) lifecycle: create/list/get/delete under `/api/v1/tunnels*`, plus ingress get/merge/set and adopt/import/reconcile. SQLite via `aerekos-record`. Tunnel **token** is returned once on create (never stored in DB). Live CF calls need `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`. `SKIP_CLOUDFLARE` is test/dev only (refused in production via `assertNoSkipFakes`).

**Works with:** [`domain_manager`](../domain_manager/README.md) — DNS/hostnames. This service owns tunnels (origins for those hostnames).

## Status / honesty

| Claim | Reality |
|-------|---------|
| Tunnel CRUD | Real SQLite + CF `cfd_tunnel` API (mock `cf-tunnel-mock-*` / `mock-tunnel-token-*` when `SKIP_CLOUDFLARE`) |
| Ingress | Local persist + CF push when not skipped; catch-all `http_status:404` kept last |
| Import / reconcile | Live CF list when configured; import returns `{ skipped: true }` under `SKIP_CLOUDFLARE` |
| Token storage | One-time on create only — not persisted |
| Prod mocks | No `SKIP_CLOUDFLARE` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — EdgeManager / ManagerConsole (no `CONSOLE_GUIDES.tunnel_manager`) |

## Access

- Direct: `http://localhost:3110/...`
- Conductor proxy: `{CONDUCTOR}/api/services/tunnel_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/tunnels` | Create tunnel (token once) |
| `GET` | `/api/v1/tunnels` | List (`?project_id=`) |
| `GET` | `/api/v1/tunnels/:id` | Get one |
| `DELETE` | `/api/v1/tunnels/:id` | Delete in CF + local DB |
| `GET`/`PATCH`/`PUT` | `/api/v1/tunnels/:id/ingress` | Ingress read / merge / replace |
| `POST` | `/api/v1/tunnels/adopt-known` | Adopt known CF tunnel ids |
| `POST` | `/api/v1/tunnels/import` | Import from Cloudflare account |
| `POST` | `/api/v1/tunnels/reconcile` | Reconcile local vs CF |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/tunnel_manager.yaml`](../../docs/openapi/tunnel_manager.yaml). Catalog: [`docs/services/tunnel_manager.md`](../../docs/services/tunnel_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.proxy('tunnel_manager', …)` (no uniform CRUD segment in SDK catalog).
- **CLI:** `aerekos call tunnel_manager …`

## Quick start

```bash
cd worker/tunnel_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3110/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3110` | Listen port |
| `DATABASE_PATH` | `data/tunnel_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_CLOUDFLARE` | unset | Skip live CF in tests/dev only |
| `CLOUDFLARE_API_TOKEN` | unset | Required for live tunnel API |
| `CLOUDFLARE_ACCOUNT_ID` | unset | Required for live tunnel API |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

Store API tokens in **secrets_manager** (Conductor: Key Manager → Service secrets), not in git. Use **key_manager** for KMS encryption keys, not raw provider tokens.

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + mergeIngress + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + tunnels CRUD/ingress/import under skip |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; CF token + account id for live tunnels |

## Related

- Conductor seed / `managerServicePorts` → `3110`
- Pairs with [`domain_manager`](../domain_manager/README.md) for public hostnames
- Catalog status `needs-keys` (Cloudflare token + account id)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

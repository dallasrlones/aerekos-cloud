# domain_manager

**AWS analog:** Route 53 · **Port:** `3111`

Project-scoped **Cloudflare DNS records** (`/api/v1/dns/records`) plus **zone list** and **hostname bindings** (pair with `tunnel_manager` CNAMEs). SQLite via `aerekos-record`. Live CF calls need `CLOUDFLARE_API_TOKEN`. `SKIP_CLOUDFLARE` is test/dev only (refused in production via `assertNoSkipFakes`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| DNS CRUD | Real SQLite + CF API under `/api/v1/dns/records` (mock `cf-mock-*` ids when `SKIP_CLOUDFLARE`) |
| Zones | `GET /api/v1/dns/zones` lists CF zones (mock zone under skip) |
| Hostnames | Local bindings CRUD; optional CNAME create when tunnel + `CLOUDFLARE_ZONE_ID` set |
| Route 53 parity | Naming analog only — Cloudflare provider, not AWS Route 53 |
| Prod mocks | No `SKIP_CLOUDFLARE` / skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — EdgeManager / ManagerConsole (no `CONSOLE_GUIDES.domain_manager`) |

## Access

- Direct: `http://localhost:3111/...`
- Conductor proxy: `{CONDUCTOR}/api/services/domain_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `GET` | `/api/v1/dns/zones` | List Cloudflare zones |
| `POST` | `/api/v1/dns/records` | Create DNS record |
| `GET` | `/api/v1/dns/records` | List (`?project_id=&zone_id=`) |
| `GET` | `/api/v1/dns/records/:id` | Get one |
| `PATCH` | `/api/v1/dns/records/:id` | Update |
| `DELETE` | `/api/v1/dns/records/:id` | Delete |
| `GET`/`POST` | `/api/v1/dns/hostnames` | List / create hostname bindings |
| `PATCH`/`DELETE` | `/api/v1/dns/hostnames/:id` | Update / delete binding |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/domain_manager.yaml`](../../docs/openapi/domain_manager.yaml). Catalog: [`docs/services/domain_manager.md`](../../docs/services/domain_manager.md).

## SDK / CLI

- **SDK (Node):** generic `client.proxy('domain_manager', …)` (no uniform CRUD segment in SDK catalog).
- **CLI:** `aerekos call domain_manager …` (no dedicated `aerekos dns` verb required for closeout).

## Quick start

```bash
cd worker/domain_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3111/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3111` | Listen port |
| `DATABASE_PATH` | `data/domain_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_CLOUDFLARE` | unset | Skip live CF in tests/dev only |
| `CLOUDFLARE_API_TOKEN` | unset | Required for live DNS |
| `CLOUDFLARE_ACCOUNT_ID` | unset | Optional zone filter |
| `CLOUDFLARE_ZONE_ID` | unset | Default zone for hostname CNAME pairing |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info/metrics + DNS CRUD + hostnames/zones |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; CF token for live DNS |

## Related

- Conductor seed / `managerServicePorts` → `3111`
- Pairs with [`tunnel_manager`](../tunnel_manager/README.md) for public hostnames
- Catalog status `needs-keys` (Cloudflare token)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

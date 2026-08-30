# Domain Manager

DNS and domain records on the public internet. **Primary provider: Cloudflare** (Zones + DNS records) so you can attach **subdomains to platform services and to your own containerized apps**, in partnership with [`tunnel_manager`](../tunnel_manager/README.md) (cloudflared ingress without opening firewall ports).

| Concern | Service |
|--------|--------|
| Hostnames, A/AAAA/CNAME/TXT | **domain_manager** (this) |
| Secure tunnel from edge → private origin (worker/container) | **tunnel_manager** |

## Status

**MVP** — Cloudflare DNS records API: project-scoped CRUD under `/api/v1/dns/records*`. Use **`SKIP_CLOUDFLARE=1`** in Jest (no live API token). Store real **`CLOUDFLARE_API_TOKEN`** (and zone/account ids) via **`secrets_manager`** or your secret pipeline—never in git. See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/domain_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3111/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Extend `tests/unit/` |
| Integration | `npm run test:integration` | supertest against exported app |
| Coverage | `npm run test:coverage` | |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## API

Resources are scoped by **`project_id`** (and Cloudflare `zone_id` as required by the API). See integration tests and `plan.md` for field shapes.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/dns/records | Create DNS record |
| GET | /api/v1/dns/records?project_id=&… | List records |
| GET | /api/v1/dns/records/:id?project_id= | Get one |
| PATCH | /api/v1/dns/records/:id?project_id= | Update |
| DELETE | /api/v1/dns/records/:id?project_id= | Delete |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map

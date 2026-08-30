# Tunnel Manager (Cloudflare)

Manage Cloudflare Tunnels (cloudflared) for safe ingress without opening firewall ports.

**Integrations:** Cloudflare API, cloudflared

**Works with:** [`domain_manager`](../domain_manager/README.md) — that service manages **DNS** (subdomains, records). This service manages **tunnels** (origins for those hostnames, often in tandem).

## Cloudflare tunnels
This service is designed to drive **Cloudflare Tunnel** (`cloudflared`) for ingress. Store API tokens and tunnel-related strings in **secrets_manager** (Conductor: **Key Manager → Service secrets**), not in git. Map names to worker env (e.g. `CLOUDFLARE_API_TOKEN`). Use **key_manager** for KMS encryption keys, not raw provider tokens.

## Status

**MVP** — Cloudflare Tunnel API (`cfd_tunnel`): create/list/get/delete under `/api/v1/tunnels*`. Tunnel **token** is returned once on create only (not stored in DB). Use **`SKIP_CLOUDFLARE=1`** in Jest. Pair with [`domain_manager`](../domain_manager/README.md) for DNS. See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/tunnel_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3110/health
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

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/tunnels | Create tunnel |
| GET | /api/v1/tunnels?project_id= | List |
| GET | /api/v1/tunnels/:id?project_id= | Get one |
| DELETE | /api/v1/tunnels/:id?project_id= | Delete tunnel in Cloudflare |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map

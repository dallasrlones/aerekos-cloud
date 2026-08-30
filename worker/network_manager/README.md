# Network Manager

Project-scoped **Docker bridge networks** (VPC-lite): create named networks per project, backed by the host Docker engine. Metadata is stored in **SQLite** via `aerekos-record`. Each logical name maps to a stable on-host network name (`aerekosn_<hash>`) so workers can align with `compute_manager` / `ServiceManager` attach patterns over time.

## Status

**MVP** — `POST/GET/DELETE /api/v1/networks`, bridge driver only; `GET /metrics` (Prometheus text). Use **`SKIP_DOCKER=1`** in tests to avoid a real Docker socket. See [`plan.md`](./plan.md).

## Quick start (local)

```bash
cd worker/network_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3103/health
```

## Environment

See [`.env_example`](./.env_example). Notable:

| Variable | Meaning |
|----------|---------|
| `DATABASE_PATH` | SQLite file (default under `data/`) |
| `DOCKER_SOCKET` | Docker API (default `/var/run/docker.sock`) |
| `SKIP_DOCKER` | `1` or `true` = no Docker; mock network names in DB (tests) |
| `CONDUCTOR_URL` | Optional; enables registration with conductor |

## API

All resources are scoped by **`project_id`** (query on GET/DELETE, or body / `X-Project-Id` on POST).

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite check) |
| GET | /ready | Readiness |
| GET | /metrics | Prometheus text |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/networks | Create: `{ "project_id", "name", "driver?": "bridge" }` (only bridge implemented) |
| GET | /api/v1/networks?project_id= | List networks for project |
| GET | /api/v1/networks/:id?project_id= | Get one |
| DELETE | /api/v1/networks/:id?project_id= | Remove Docker network and DB row |

Duplicate logical `name` per project returns **409**.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Integration | `npm test` | Uses temp `DATABASE_PATH` + `SKIP_DOCKER=1` |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle; future: attach service containers to networks created here
- See root [`plan.md`](../../plan.md) for full platform map

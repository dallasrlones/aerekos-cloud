# Network Manager

Project-scoped **Docker bridge networks** (VPC-lite): create named networks per project, backed by the host Docker engine. Metadata is stored in **SQLite** via `aerekos-record`. Each logical name maps to a stable on-host network name (`aerekosn_<hash>`) so workers can align with `compute_manager` / `ServiceManager` attach patterns over time. Optional **Headscale mesh** helpers under `/api/v1/mesh` when `HEADSCALE_URL` is set.

## Status

**MVP** — `POST/GET/DELETE /api/v1/networks` (bridge only), `POST …/networks/ensure-default`, `GET /metrics`, mesh preauth helpers. **Tutorial:** none. **SDK:** generic `client.proxy('network_manager', …)` or `client.resource('network_manager', 'networks')` — no typed `client.network` helper yet. **OpenAPI:** `api/openapi.yaml` (pack copy: `docs/openapi/network_manager.yaml`).

No production mocks — shared `assertNoSkipFakes()` refuses `SKIP_DOCKER=1` when `NODE_ENV=production`. Use **`SKIP_DOCKER=1`** in tests only.

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
| `SKIP_DOCKER` | `1` or `true` = no Docker; mock network names in DB (**tests only**) |
| `CONDUCTOR_URL` | Optional; enables registration with conductor |
| `HEADSCALE_URL` | Optional; enables mesh status / remote preauth mint |

## API

All network resources are scoped by **`project_id`** (query on GET/DELETE, or body / `X-Project-Id` on POST).

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
| POST | /api/v1/networks/ensure-default | Ensure logical name `default` |
| GET | /api/v1/mesh | Mesh status |
| POST | /api/v1/mesh/preauth | Mint preauth key (shown once) |
| POST | /api/v1/mesh/preauth/:id/revoke | Revoke (blocks `tag:worker` / `tag:platform` unless `force`) |

Duplicate logical `name` per project returns **409**. Non-bridge drivers return **501**.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit + integration | `npm test` | Temp `DATABASE_PATH` + `SKIP_DOCKER=1` |
| E2E | `tests/e2e/README.md` | Live proxy needs conductor; parked until stack is up |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle; future: attach service containers to networks created here
- See root [`plan.md`](../../plan.md) for full platform map

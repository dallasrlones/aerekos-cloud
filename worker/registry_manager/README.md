# Container Registry Manager

**Policy and discovery** for where worker images are pulled from (Harbor, embedded `registry:2`, Docker Hub, etc.). The worker’s Docker engine does the real pull; see **[`REGISTRY.md`](./REGISTRY.md)** for the full integration story.

## What this service does

- `GET /api/v1/registry/config` — public, non-secret settings (`REGISTRY_MODE`, display URL, whether auth is expected on workers).
- `GET /metrics` — Prometheus text (shared helper).
- Does **not** store registry passwords; use `secrets_manager` and host `docker login`.

## Quick start (local)

```bash
cd worker/registry_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3129/health
# curl http://localhost:3129/api/v1/registry/config
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
| Integration | `npm run test:integration` | supertest |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness |
| GET | /ready | Readiness |
| GET | /metrics | Prometheus text |
| GET | /api/v1/info | Service metadata |
| GET | /api/v1/registry/config | Public registry hints (no credentials) |

## Related

- [`worker/docker/ServiceManager.js`](../docker/ServiceManager.js) — `pullImage`, `buildContainerConfig`
- Conductor `Service.docker_image` — full OCI ref when using private registries

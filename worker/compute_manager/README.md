# Compute Manager

**ECS-style tasks** on the worker: run an arbitrary **Docker image** with optional command, env, and port maps. The worker’s Docker socket (same family as `worker/docker/ServiceManager.js`) is used via **dockerode**. State is stored in **SQLite** (`aerekos-record`).

## Status

**MVP** — create/list/get/stop/delete tasks, optional `?refresh=1` to sync status from `docker inspect`. For production, **pre-pull images** on the worker (or extend with registry pull). Set **`SKIP_DOCKER=1`** in tests to avoid a real engine.

## Default port

**`3100`**

## Quick start (local, real Docker)

```bash
cd worker/compute_manager
cp .env_example .env
npm install
# Pull a test image first, e.g. docker pull alpine:3.19
npm run dev
# curl http://localhost:3100/health
```

## Environment

| Variable | Default | Meaning |
|----------|---------|---------|
| `DATABASE_PATH` | `data/compute_manager.db` | Metadata |
| `DOCKER_SOCKET` | `/var/run/docker.sock` | Docker API |
| `COMPUTE_DOCKER_NETWORK` | — | Optional network to attach (same pattern as `ServiceManager` detecting worker network can be added later) |
| `SKIP_DOCKER` | — | `1` in tests: no Docker calls |
| `CONDUCTOR_URL` | — | Conductor registration |

## API

`project_id`: query, body, or `X-Project-Id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health, /ready | Liveness; readiness includes DB |
| GET | /api/v1/info | |
| POST | /api/v1/tasks | `name`, `project_id`, `image`, `command?`, `env?`, `port_bindings?` (e.g. `{"80/tcp": "18080"}`), `run_mode?` (`service` default, `oneshot`) |
| GET | /api/v1/tasks?project_id= | List |
| GET | /api/v1/tasks/:id?project_id= | Get; add `refresh=1` to sync from Docker |
| POST | /api/v1/tasks/:id/stop | Stop container |
| DELETE | /api/v1/tasks/:id?project_id= | Remove container (best effort) and row |

**Names** are **unique per project** (1–64 chars `[a-zA-Z0-9_-]`). Container name on host: `aer-cmp-{idprefix}-{name}` (truncated, lowercased). Labels: `aerekos.project_id`, `aerekos.task_id`, `aerekos.task_name`.

## Testing

`npm test` — uses `SKIP_DOCKER=1` from `tests/beforeFile.js`.

## Conductor

Service seed: `aerekos-compute_manager:latest`, port **3100** (see `conductor/scripts/seedServices.js`).

## Related

- **`DeploymentHandler` / `ServiceManager`**: same worker Docker patterns for first-party services; **compute_manager** is for *user-defined* ad-hoc containers.

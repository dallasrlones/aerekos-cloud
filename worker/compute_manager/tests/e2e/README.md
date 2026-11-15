# E2E tests — Compute Manager

Live / CI-job scenarios against a running stack. Unit + integration cover health/proxy honesty with `SKIP_DOCKER=1` (Node 20, `npm test`).

## Prerequisites

- Conductor and at least one worker running
- This service built and registered (or `CONDUCTOR_URL` set for auto-register)
- **Do not** set `SKIP_DOCKER` on production compose — boot refuses it when `NODE_ENV=production`

## Proxy honesty

| Path | Expectation |
|------|-------------|
| `GET {CONDUCTOR}/api/services/compute_manager/health` | 200 `{ status: "healthy", service: "compute_manager" }` |
| `GET {CONDUCTOR}/api/services/compute_manager/ready` | 200 when SQLite ok |
| `GET {CONDUCTOR}/api/services/compute_manager/api/v1/info` | 200 `{ status: "active" }` |
| `POST …/api/v1/tasks` | JWT or service token; `project_id` required |

## Scenarios (checklist)

- [ ] **E2E-1:** Start `compute_manager` container; `GET /health` from another container on the same Docker network returns 200.
- [ ] **E2E-2:** Conductor lists service in registry; proxy `/api/services/compute_manager/...` works.
- [ ] **E2E-3:** Create task with a pre-pulled image; list/get/stop/delete via proxy.
- [ ] **E2E-4:** Graceful shutdown: SIGTERM finishes in-flight requests then exits.
- [ ] **E2E-5:** With `NODE_ENV=production`, process refuses to start if `SKIP_DOCKER=1`.

## Automating

Add `tests/e2e/*.spec.js` or run root wave e2e (`e2e/wave2-tunnel-compute-iam.js`) against compose URLs in CI.

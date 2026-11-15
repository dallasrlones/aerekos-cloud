# E2E tests — Network Manager

Live conductor-proxy scenarios are **parked** until a conductor + worker stack is available. Unit/integration (`npm test` with `SKIP_DOCKER=1`) cover the DoD health/API surface.

## Prerequisites
- Conductor and at least one worker running
- This service built and registered (or `CONDUCTOR_URL` set for auto-register)

## Scenarios (checklist)
- [ ] **E2E-1:** Start `network_manager` container; `GET /health` from another container on the same Docker network returns 200.
- [ ] **E2E-2:** Conductor lists service in registry; proxy `/api/services/network_manager/health` and `/api/services/network_manager/api/v1/networks` work with JWT.
- [ ] **E2E-3:** `POST …/networks/ensure-default` then create/list/delete via proxy for a non-prod project.
- [ ] **E2E-4:** Graceful shutdown: SIGTERM finishes in-flight requests then exits.
- [ ] **E2E-5:** Invalid auth returns 401/403 consistently when conductor auth is enforced.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Automating
Add `tests/e2e/*.spec.js` with Playwright or run supertest against `docker compose` URLs in CI (`test:e2e:ci` script).

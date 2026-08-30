# E2E tests — Container Registry Manager

These are **manual / CI-job** scenarios until Playwright or a full docker-compose test harness is added.

## Prerequisites
- Conductor and at least one worker running
- This service built and registered (or `CONDUCTOR_URL` set for auto-register)

## Scenarios (checklist)
- [ ] **E2E-1:** Start `registry_manager` container; `GET /health` from another container on the same Docker network returns 200.
- [ ] **E2E-2:** Conductor lists service in registry; proxy `/api/services/registry_manager/...` works if routing is enabled.
- [ ] **E2E-3:** Graceful shutdown: SIGTERM finishes in-flight requests then exits.
- [ ] **E2E-4:** Invalid auth (when implemented) returns 401/403 consistently.
- [ ] **E2E-5:** Load test: baseline latency under expected RPS (define SLO in plan.md).

## Automating
Add `tests/e2e/*.spec.js` with Playwright or run supertest against `docker compose` URLs in CI (`test:e2e:ci` script).

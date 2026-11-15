# E2E tests — Schedule Manager

Live stack scenarios are **parked** until conductor + worker are available on the LAN (Wave 2 closeout: unit/integration covered; live proxy manual).

## Prerequisites
- Conductor and at least one worker running
- This service built and registered (or `CONDUCTOR_URL` set for auto-register)
- **Port:** if `key_manager` already binds host `3102`, schedule_manager cannot also bind `3102` — use a free `PORT` for ad-hoc local e2e or resolve the fleet collision first

## Scenarios (checklist)
- [ ] **E2E-1:** Start `schedule_manager` container; `GET /health` from another container on the same Docker network returns 200.
- [ ] **E2E-2:** Conductor lists service in registry; proxy `/api/services/schedule_manager/health` works without `projectId` (`isLiveness`).
- [ ] **E2E-3:** Create schedule + `POST …/run` through conductor proxy with JWT.
- [ ] **E2E-4:** Graceful shutdown: SIGTERM finishes in-flight requests then exits.

## Automating
Add `tests/e2e/*.spec.js` with Playwright or run supertest against `docker compose` URLs in CI (`test:e2e:ci` script).

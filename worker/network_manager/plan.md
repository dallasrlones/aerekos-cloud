# Network Manager — implementation plan

**Service:** `network_manager`  
**Default port:** 3103  
**Capabilities (registry):** networks, isolation, docker_networks  
**Description:** Project-scoped Docker networks and isolation labels (VPC-lite).

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, `docker-compose`, Jest harness

## Phase 2 — Domain model & persistence
- [x] `ProjectNetwork` in SQLite via `aerekos-record`
- [x] Project scoping (`project_id`) on all resources
- [ ] Deeper DB migrations / indexes if you outgrow the MVP schema

## Phase 3 — API surface
- [x] Route map in `README.md`
- [x] Hand validation in `ProjectNetworkService` (MVP)
- [ ] OpenAPI / shared validators (Joi or zod)
- [ ] Service-to-service auth middleware (conductor validate-token)

## Phase 4 — Worker & deployment integration
- [x] `Dockerfile` + conductor `seedServices` (port 3103)
- [ ] Worker `ServiceManager` attaches user services to a chosen network id (orchestrator contract)

## Phase 5 — Observability
- [ ] Structured JSON logging
- [x] `GET /metrics` (shared `simplePrometheusMetrics` counter)
- [ ] Correlation / request IDs

## Phase 6 — Security
- [ ] Rate limits on public routes
- [ ] Audit log for sensitive operations
- [ ] Integration with `iam_manager` / `secrets_manager` as needed

---

## Testing (mandatory before “done”)

### Unit tests
- [ ] Core business logic (services layer) — happy paths
- [ ] Core business logic — error and edge cases
- [ ] Validators and pure utilities — 100% of public functions covered
- [ ] Mock external HTTP (axios) and Docker APIs where applicable

### Integration tests
- [ ] HTTP API with supertest (no manual server) — all routes return expected status/body
- [ ] Database layer against temp SQLite (if applicable)
- [ ] Conductor registration mocked; failure paths (404, 500)

### E2E tests
- [ ] Document scenarios in `tests/e2e/README.md` — all checkboxes executed at least once per release
- [ ] Optional: Playwright or CI job hitting docker-compose URLs
- [ ] Cross-service: conductor + worker + this service + one dependency (e.g. key_manager)

### Coverage & quality gates
- [ ] `npm run test:coverage` meets team threshold (suggest ≥70% lines for new code)
- [ ] No flaky timers — use Jest fake timers where needed
- [ ] Load smoke test script in `scripts/` (optional)

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

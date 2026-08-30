# Compute Manager — implementation plan

**Service:** `compute_manager`  
**Default port:** 3100  
**Capabilities (registry):** containers, tasks, deploy  
**Description:** Run and manage containerized workloads (ECS/Fargate-style task API) on workers selected by the conductor.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] `Task` model + SQLite, `project_id` scoping, unique per-project `name`

## Phase 3 — API surface
- [x] README route map; `DockerService` + `TaskService`
- [ ] Deeper validation (Joi / zod)
- [ ] Service-to-service auth (conductor validate-token)

## Phase 4 — Worker & deployment integration
- [x] dockerode; labels aligned with `ServiceManager` conventions; `SKIP_DOCKER` for CI
- [x] `.env_example` (via README + env table)

## Phase 5 — Observability
- [ ] Structured JSON logging
- [ ] `GET /metrics` (Prometheus) or push to `metrics_manager`
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

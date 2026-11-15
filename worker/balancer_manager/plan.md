# Balancer Manager — implementation plan

**Service:** `balancer_manager`  
**Default port:** 3109  
**Capabilities (registry):** load_balancing, health_checks / load-balancing, targets  
**Description:** Layer-7 routing hints and health-aware backends; complements conductor LoadBalancer.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (MVP complete)
- [x] `BalancerTarget` via `aerekos-record` / SQLite
- [x] Project scoping (`project_id`) on all resources
- [ ] Migrations beyond aerekos-record model — later if needed

## Phase 3 — API surface (MVP complete)
- [x] OpenAPI + route map in README
- [x] Basic validation in service layer
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Environment contract documented in `.env_example`
- [ ] Image build via worker `ServiceManager` polish — later

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes` refuses skip flags in production
- [ ] Rate limits / IAM integration — later

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] BalancerTargetService create/list/get/update/delete + healthSummary (`SKIP_HEALTH`)
- [x] Prod mock guard / `assertNoSkipFakes` policy (`tests/unit/health.test.js`, `prodMockGuard.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `/metrics` (`tests/integration/health.test.js`)
- [x] targets CRUD + health endpoints against temp SQLite (`tests/integration/crud.test.js`)
- [x] Conductor registration skipped via `SKIP_SERVICE_REGISTRATION`

### E2E tests
- [x] Scenarios documented in `tests/e2e/README.md` (live proxy parked until conductor stack up)
- [ ] Live conductor proxy checklist executed when stack available

### Coverage & quality gates
- [x] `npm test` (unit + integration) green for closeout gate
- [ ] Optional coverage threshold / load smoke — later

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

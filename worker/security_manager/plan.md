# Security Manager — implementation plan

**Service:** `security_manager`  
**Default port:** 3108  
**Capabilities (registry):** security, findings  
**Description:** Project-scoped security finding records; scanner/SIEM integration later.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / secrets_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] SecurityFinding via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on all resources
- [ ] Migrations / richer schema — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Basic validation (project_id/name)
- [x] Metadata-only `POST /api/v1/findings/scan`
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via `simplePrometheusMetrics`)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes()` on boot (shared skip-fakes refused in production)
- [ ] Rate limits / audit / iam hooks — later
- [ ] Live scanners / SIEM — parked

---

## Testing (Wave 6 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` wiring (`tests/unit/`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `/metrics` (`tests/integration/health.test.js`)
- [x] Findings CRUD + scan (`tests/integration/crud.test.js`)
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

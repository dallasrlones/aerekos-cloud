# Worker Manager — implementation plan

**Service:** `worker_manager`  
**Default port:** 3128  
**Capabilities (registry):** fleet, labels  
**Description:** Fleet-level worker annotations (labels) beyond the single-node worker agent.

## Dependencies
- **Platform:** Conductor (`/api/workers` for sync), SQLite via `aerekos-record`

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info, /metrics
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness
- [x] `assertNoSkipFakes()` on boot

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] WorkerAnnotation entity (SQLite / aerekos-record)
- [x] Project scoping (`project_id`) on all resources
- [x] `POST /api/v1/sync` upsert from conductor workers

## Phase 3 — API surface (MVP)
- [x] OpenAPI / route map in README + pack
- [x] Validation (project_id / name required; name uniqueness)
- [ ] Service-to-service auth middleware (conductor validate-token) — via proxy

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Structured JSON logging / correlation IDs (future)

## Phase 6 — Security
- [x] Prod mock guard (`assertNoSkipFakes`)
- [ ] Rate limits / audit (future)

---

## Testing (Wave 8 closeout)

### Unit tests
- [x] `assertNoSkipFakes` refuse/allow + index wiring
- [x] Prod mock guard policy (`prodMockGuard.test.js`)

### Integration tests
- [x] health / ready / info
- [x] annotations CRUD round-trip + validation
- [x] sync without conductor → 503

### E2E tests
- [x] Document parked live conductor scenarios in `tests/e2e/README.md`
- [ ] Live proxy + sync against conductor (parked — needs stack)

### Coverage & quality gates
- [x] `npm test` (unit + integration) runnable locally
- [ ] Coverage threshold (optional)

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

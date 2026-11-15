# Logs Manager — implementation plan

**Service:** `logs_manager`  
**Default port:** 3104  
**Capabilities (registry):** logs, ingest  
**Description:** Ingest, store, and query structured logs from services and workers.

## Status (Wave 5 closeout)

MVP implemented: LogEvent CRUD/ingest/query/batch/compact, `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes()`, OpenAPI pack. Live proxy e2e parked pending conductor.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] LogEvent via `aerekos-record` / SQLite
- [x] Project scoping (`project_id`) on all resources

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Ingest, batch, query filters, get, delete, compact
- [ ] Service-to-service auth middleware (conductor validate-token) — platform-level

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`
- [x] Worker outbox shipper posts to `/api/v1/logs/batch` via conductor proxy

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Correlation / request IDs — shared platform

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes`)
- [ ] Rate limits / audit — shared platform / other managers

---

## Testing (Wave 5 closeout)

### Unit tests
- [x] LogEventService create/list/get/delete/batch/compact + validation
- [x] Prod mock guards / `assertNoSkipFakes`

### Integration tests
- [x] health / ready / info / metrics
- [x] logs ingest/query/batch/delete/compact

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked until conductor stack

### Coverage & quality gates
- [x] `npm test` (unit + integration) green for closeout gate

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

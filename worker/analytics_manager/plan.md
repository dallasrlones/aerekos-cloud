# Analytics Manager — implementation plan

**Service:** `analytics_manager`  
**Default port:** 3117  
**Capabilities (registry):** analytics, events  
**Description:** Event ingestion and rollups for product analytics (privacy-aware, self-hosted).

## Status (Wave 4 closeout)

MVP implemented: events CRUD, query-on-storage (SQLite over loaded rows), `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes` (+ `SKIP_DUCKDB`), OpenAPI pack. Live proxy e2e parked pending conductor.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] AnalyticsEvent via `aerekos-record` / SQLite
- [x] Project scoping (`project_id`) on all resources

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] query-on-storage (SQLite engine; ATTACH/VACUUM rejected)
- [ ] Service-to-service auth middleware (conductor validate-token) — platform-level

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Correlation / request IDs — shared platform

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes` + `SKIP_DUCKDB`)
- [ ] Rate limits / audit — shared platform / other managers

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] AnalyticsEventService CRUD + validation
- [x] Prod mock guards / `assertNoSkipFakes` (incl. SKIP_DUCKDB)

### Integration tests
- [x] health / ready / info / metrics
- [x] events CRUD
- [x] query-on-storage SELECT + ATTACH reject

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked until conductor stack

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

# Query Manager — implementation plan

**Service:** `query_manager`  
**Default port:** 3145  
**Capabilities (registry):** athena, sql  
**Description:** SQL query definitions + per-project SQLite execution (Athena naming analog).

## Status (Wave 6 closeout)

MVP implemented: queries CRUD, `POST /sql` (better-sqlite3), ensure-defaults, `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes({ extra: ['SKIP_DUCKDB'] })`, OpenAPI pack. Live proxy e2e parked pending conductor. Athena/DuckDB lake query parked (naming only).

## Dependencies
- **Platform:** Conductor, worker (Docker)

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] Query Item via `aerekos-record` / SQLite
- [x] Project scoping (`project_id`) on all resources
- [x] Per-project SQL data files under `QUERY_DATA_DIR`

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] CRUD + ensure-defaults + `/sql` (ATTACH/VACUUM rejected)
- [ ] Service-to-service auth middleware (conductor validate-token) — platform-level

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes` + `SKIP_DUCKDB` extra)
- [ ] Rate limits / audit — shared platform / other managers

---

## Testing (Wave 6 closeout)

### Unit tests
- [x] Prod mock guards / `assertNoSkipFakes` + `SKIP_DUCKDB` wiring

### Integration tests
- [x] health / ready / info / metrics / ensure-defaults
- [x] queries CRUD
- [x] `POST /sql` real sqlite + ATTACH reject + SKIP_DUCKDB short-circuit

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked until conductor stack

### Coverage & quality gates
- [x] `npm test` (unit + integration) green for closeout gate

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

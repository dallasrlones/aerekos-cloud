# Audit Manager — implementation plan

**Service:** `audit_manager`  
**Default port:** 3149  
**Capabilities (registry):** audit  
**Description:** Project-scoped audit event store (CloudTrail analog).

## Dependencies
- **Platform:** Conductor, worker (Docker)

## Phase 1 — Service layout (complete)
- [x] Express app via `createManagerApp`, /health, /ready, /api/v1/info, /metrics
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] `Item` model: project_id, name, actor, action, detail (SQLite via `aerekos-record`)
- [x] Project scoping on CRUD
- [x] `ensureDefaults` bootstrap event

## Phase 3 — API surface (MVP complete)
- [x] Events CRUD + ingest + OpenAPI / README route map
- [ ] Stronger validation (Joi/zod) — later
- [ ] Service-to-service auth middleware — later (conductor proxy today)

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; seed port `3149`
- [x] Environment contract in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` via shared bootstrap
- [ ] Correlation / request IDs — later

## Phase 6 — Security
- [ ] Rate limits / retention policies — later
- [ ] Cross-service emit helpers (other managers → ingest) — later

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] ItemService create validation + ensureDefaults (`tests/unit/ItemService.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, ensure-defaults (`tests/integration/health.test.js`)
- [x] events CRUD + ingest (`tests/integration/crud.test.js`)

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

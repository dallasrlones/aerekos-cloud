# API Manager — implementation plan

**Service:** `api_manager`  
**Default port:** 3124  
**Capabilities (registry):** api_gateway, routes  
**Description:** Click-to-build or template-driven HTTP APIs routed through conductor.

## Status (Wave 3 closeout)

MVP implemented: endpoints CRUD, seed-presets, match (+ optional WAF), scale, Data API apply/CRUD, `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes`, OpenAPI pack. Live proxy e2e parked pending conductor.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager / waf_manager / function_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] ApiRoute + Data API models via `aerekos-record` / SQLite
- [x] Migrations for ARN / proxy columns
- [x] Project scoping (`project_id`) on all resources

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] ARN template validation; match → `proxy_path`
- [ ] Service-to-service auth middleware (conductor validate-token) — platform-level

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [ ] Environment contract documented in `.env_example` (optional polish)

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Correlation / request IDs — shared platform

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes`)
- [ ] Rate limits / audit — shared platform / other managers

---

## Testing (Wave 3 closeout)

### Unit tests
- [x] `assertNoSkipFakes` refuses SKIP_INVOKE / SKIP_DB_PROVISION in production

### Integration tests
- [x] health / ready / info
- [x] endpoints CRUD
- [x] gateway match + INVALID_ARN_TEMPLATE
- [x] seed-presets + Data API smoke

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked until conductor stack

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

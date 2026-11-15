# MCP Manager — implementation plan

**Service:** `mcp_manager`  
**Default port:** 3123  
**Capabilities (registry):** mcp, tools  
**Description:** Register and proxy MCP tool servers for AI/agent workflows.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [ ] Define entities and storage (SQLite via `aerekos-record` and/or conductor APIs)
- [ ] Repositories and migrations if using local DB
- [ ] Project scoping (`project_id`) on all resources

## Phase 3 — API surface
- [ ] OpenAPI / route map in README
- [ ] Validation (Joi or zod)
- [ ] Service-to-service auth middleware (conductor validate-token)

## Phase 4 — Worker & deployment integration
- [ ] Image build via worker `ServiceManager`; health checks for orchestrator
- [ ] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [ ] Structured JSON logging
- [ ] `GET /metrics` (Prometheus) or push to `metrics_manager`
- [ ] Correlation / request IDs

## Phase 6 — Security
- [ ] Rate limits on public routes
- [ ] Audit log for sensitive operations
- [ ] Integration with `iam_manager` / `secrets_manager` as needed

---

## Testing (Wave 3 closeout)

### Unit tests
- [x] platform-tools catalog exports required names/fields (`tests/unit/health.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `/api/v1/platform-tools` (`tests/integration/health.test.js`)
- [x] tools CRUD + invoke-without-endpoint 400 (`tests/integration/crud.test.js`)

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

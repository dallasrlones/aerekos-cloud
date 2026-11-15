# Crawler Manager — implementation plan

**Service:** `crawler_manager`  
**Default port:** 3121  
**Capabilities (registry):** crawling, jobs  
**Description:** Scheduled fetch/crawl jobs with rate limits and storage hooks.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] CrawlJob entity via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on all resources
- [ ] Migrations / richer schema — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Basic validation (project_id/name/start_url)
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via `simplePrometheusMetrics`)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes({ extra: ['SKIP_CRAWL'] })` on boot
- [ ] Rate limits / audit / iam hooks — later

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` + `SKIP_CRAWL` policy (`tests/unit/`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info` (`tests/integration/health.test.js`)
- [x] jobs CRUD + run under `SKIP_CRAWL` (`tests/integration/crud.test.js`)
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

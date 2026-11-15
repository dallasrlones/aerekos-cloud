# Metrics Manager — implementation plan

**Service:** `metrics_manager`  
**Default port:** 3105  
**Capabilities (registry):** metrics, samples, alarms  
**Description:** Scrape or receive metrics; expose Prometheus format; optional alert routing into event_manager.

## Status (Wave 6 closeout)

MVP implemented: MetricSeries CRUD/sample/scrape, MetricAlarm CRUD/evaluate, `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes()`, OpenAPI pack. Live proxy e2e parked pending conductor. Aggregation cluster / federation out of scope.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional `event_manager` for alarm publish

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] MetricSeries + MetricAlarm via `aerekos-record` / SQLite
- [x] Project scoping (`project_id`) on all resources

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Series CRUD, sample upsert, scrape helper, list filters
- [x] Alarm CRUD + evaluate (SKIP_OUTBOUND parks publish)
- [ ] Service-to-service auth middleware (conductor validate-token) — platform-level

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Aggregation cluster / Prometheus federation — future

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes`)
- [ ] Rate limits / audit — shared platform / other managers

---

## Testing (Wave 6 closeout)

### Unit tests
- [x] MetricSeriesService create/list/get/update/delete/sample + validation
- [x] Prod mock guards / `assertNoSkipFakes`

### Integration tests
- [x] health / ready / info / metrics
- [x] series CRUD + filters; alarms CRUD + evaluate (SKIP_OUTBOUND)

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked until conductor stack

### Coverage & quality gates
- [x] `npm test` (unit + integration) green for closeout gate

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

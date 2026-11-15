# Event Manager — implementation plan

**Service:** `event_manager`  
**Default port:** 3132  
**Capabilities (registry):** events, bus  
**Description:** Project-scoped event buses, rules, and put-event fan-out (EventBridge analog).

## Dependencies
- **Platform:** Conductor, worker (Docker), optional queue_manager / function_manager / websocket_manager / iot_manager for live targets

## Phase 1 — Service layout (complete)
- [x] Express app via `createManagerApp`, /health, /ready, /api/v1/info, /metrics
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, Jest harness

## Phase 2 — Domain model & persistence
- [x] Bus + Rule entities via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on all resources
- [ ] Migrations / richer schema — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Buses CRUD, rules create/list, put events, ensure-defaults
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via `simplePrometheusMetrics`)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes({ extra: ['SKIP_OUTBOUND'] })` on boot (+ `createManagerApp`)
- [ ] Rate limits / audit / iam hooks — later

---

## Testing (Wave 5 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` + `SKIP_OUTBOUND` policy (`tests/unit/`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info` (`tests/integration/health.test.js`)
- [x] buses CRUD (`tests/integration/crud.test.js`)
- [x] rules + put event under `SKIP_OUTBOUND` (`tests/integration/events.test.js`)
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

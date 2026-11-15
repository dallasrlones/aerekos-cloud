# CDN Manager — implementation plan

**Service:** `cdn_manager`  
**Default port:** 3118  
**Capabilities (registry):** cdn, cache_rules  
**Description:** CDN configuration and cache rule management (provider-pluggable).

## Dependencies
- **Platform:** Conductor, worker (Docker), optional secrets_manager / domain_manager
- **Pro edge:** Cloudflare token + zone (see `docs/plans/cdn_manager.md`)

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness
- [x] `assertNoSkipFakes()` on boot

## Phase 2 — Domain model & persistence
- [x] `CdnRule` SQLite via `aerekos-record` (project_id, name, path_pattern, origin, cache_ttl_seconds)
- [x] Project scoping (`project_id`) on all rule resources

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Rules CRUD + probe; purge / parked cache-rules / waf endpoints
- [ ] Service-to-service auth middleware (conductor validate-token) — parked with live e2e

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via shared helper)
- [ ] Structured JSON logging / correlation IDs — deferred

## Phase 6 — Security / edge pro
- [x] No prod mocks / skip-fake flags in production
- [ ] EDGE-PRO-4a–4g CF Cache Rules write + EdgeManager CDN tab — parked

## SDK / CLI / tutorial
- SDK/CLI: generic proxy / `aerekos call` / `client.resource('cdn_manager', 'rules')` only
- Tutorial / ServiceGuide: **none** (no `CONSOLE_GUIDES.cdn_manager`)

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` (`tests/unit/health.test.js`, `prodMockGuard.test.js`)
- [x] CloudflareEdge honesty — no fake `applied:true` (`tests/unit/CloudflareEdge.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info` (`tests/integration/health.test.js`)
- [x] Rules CRUD + parked purge/cache-rules (`tests/integration/crud.test.js`)

### E2E tests
- [x] Documented in `tests/e2e/README.md` — live proxy parked pending conductor

### Coverage & quality gates
- [x] `npm test` (Node 20) green for unit + integration

---

## References
- [new_service.md](../../new_service.md)
- [docs/plans/cdn_manager.md](../../docs/plans/cdn_manager.md)
- [testing_guidelines.md](../../testing_guidelines.md)

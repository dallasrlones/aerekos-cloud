# Tunnel Manager (Cloudflare) — implementation plan

**Service:** `tunnel_manager`  
**Default port:** 3110  
**Capabilities (registry):** tunnels, cloudflare, ingress  
**Description:** Manage Cloudflare Tunnels (cloudflared) for safe ingress without opening firewall ports.

**Relationship to [`domain_manager`](../domain_manager/plan.md):** Tunnels carry traffic from Cloudflare’s edge to private origins. **`domain_manager`** owns DNS (which hostname points where). Implement both for a full “subdomain + tunnel” story for services and user apps in containers.

MVP implemented: tunnels CRUD, ingress get/merge/set, adopt/import/reconcile, `/health` `/ready` `/info` `/metrics`, `assertNoSkipFakes()` (`SKIP_CLOUDFLARE` refused in production), OpenAPI pack. Live proxy e2e parked pending conductor + CF credentials.

## Dependencies
- **Platform:** Cloudflare API, cloudflared
- **Complements:** [`domain_manager`](../domain_manager/plan.md)
- **Optional:** `key_manager` / `secrets_manager` for CF credentials

### Cloudflare (required reading)
- [x] Document `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN` (Tunnel permissions)
- [ ] `cloudflared` sidecar or host install; token-based tunnel auth — ops/runtime
- [x] Never commit tunnel credentials; use secrets_manager or key_manager

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] Tunnel rows via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on resources
- [ ] Migrations / richer schema — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Basic validation (project_id/name)
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via `simplePrometheusMetrics`)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes()` on boot (`SKIP_CLOUDFLARE` refused in production)
- [ ] Rate limits / audit / iam hooks — later

---

## Testing (Wave 7 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` + `SKIP_CLOUDFLARE` policy (`tests/unit/`)
- [x] `mergeRules` keeps catch-all last (`tests/unit/mergeIngress.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `/metrics` (`tests/integration/health.test.js`)
- [x] Tunnels CRUD + ingress + import skip under `SKIP_CLOUDFLARE` (`tests/integration/tunnelsApi.test.js`)
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

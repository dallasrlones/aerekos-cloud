# Domain Manager — implementation plan

**Service:** `domain_manager`  
**Default port:** 3111  
**Capabilities (registry):** dns, domains  
**Description:** DNS and domain records; **primary provider: Cloudflare** (pluggable later).

## Product vision (Cloudflare)

This is the control plane for **names** on the public internet:

- **Per-project or per-app subdomains** backed by the Cloudflare **DNS** API (A/AAAA/CNAME/TXT).
- **Peering with `tunnel_manager`:** tunnels expose private origins; DNS (often CNAMEs to `{id}.cfargotunnel.com`) gives stable hostnames.
- **Hostname bindings:** local inventory linking hostname → compute/balancer/platform target (optional DNS create).

**API token scoping:** least privilege—Zone:DNS:Edit (and zone list as needed); store via secrets pipeline, not env in repo.

## Dependencies
- **Platform:** Conductor, worker (Docker)
- **Edge:** [Cloudflare API](https://developers.cloudflare.com/api/) (Zones, DNS Records)
- **Complements:** [`tunnel_manager`](../tunnel_manager/plan.md)
- **Optional:** `key_manager` / `secrets_manager` for CF credentials

## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] DnsRecord + HostnameBinding via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on resources
- [ ] Migrations / richer schema — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] Basic validation (project_id/zone_id/name/type/content)
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

## Testing (Wave 5 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` + `SKIP_CLOUDFLARE` policy (`tests/unit/`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `/metrics` (`tests/integration/health.test.js`)
- [x] DNS records CRUD under `SKIP_CLOUDFLARE` (`tests/integration/dnsApi.test.js`)
- [x] Zones + hostnames CRUD (`tests/integration/hostnames.test.js`)
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

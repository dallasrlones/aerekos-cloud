# Domain Manager — implementation plan

**Service:** `domain_manager`  
**Default port:** 3111  
**Capabilities (registry):** dns, domains  
**Description:** DNS and domain records; **primary provider: Cloudflare** (pluggable later).

## Product vision (Cloudflare)

This is the control plane for **names** on the public internet:

- **Per-project or per-app subdomains** (e.g. `api.<project>.example.com`, `app.<project>.example.com`) backed by the Cloudflare **DNS** API (create/update/delete A/AAAA/CNAME/TXT as needed).
- **Peering with `tunnel_manager`:** Tunnels (cloudflared) expose private origins; DNS records (often CNAMEs to a tunnel or Cloudflare routing metadata) are how users and services get a stable hostname. *DNS here does not replace tunnels*—it complements them. Typical flow: tunnel defines ingress to a container port; `domain_manager` creates the hostname under your zone.
- **Future:** your own containerized apps get the same treatment as first-party services: one subdomain (or custom domain) per deploy, with secrets for API tokens in **`secrets_manager`** (or `key_manager` material) and no credentials in git.

**API token scoping (when implementing):** least privilege—Zone:DNS:Edit (and as needed for zone list) in the right account; store via secrets pipeline, not env in repo.

## Dependencies
- **Platform:** Conductor, worker (Docker)
- **Edge:** [Cloudflare API](https://developers.cloudflare.com/api/) (Zones, DNS Records)
- **Complements:** [`tunnel_manager`](../tunnel_manager/plan.md) (cloudflared lifecycle)
- **Optional:** `key_manager` / `db_manager` for persistence, `secrets_manager` for CF credentials


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

## Testing (mandatory before “done”)

### Unit tests
- [ ] Core business logic (services layer) — happy paths
- [ ] Core business logic — error and edge cases
- [ ] Validators and pure utilities — 100% of public functions covered
- [ ] Mock external HTTP (axios) and Docker APIs where applicable

### Integration tests
- [ ] HTTP API with supertest (no manual server) — all routes return expected status/body
- [ ] Database layer against temp SQLite (if applicable)
- [ ] Conductor registration mocked; failure paths (404, 500)

### E2E tests
- [ ] Document scenarios in `tests/e2e/README.md` — all checkboxes executed at least once per release
- [ ] Optional: Playwright or CI job hitting docker-compose URLs
- [ ] Cross-service: conductor + worker + this service + one dependency (e.g. key_manager)

### Coverage & quality gates
- [ ] `npm run test:coverage` meets team threshold (suggest ≥70% lines for new code)
- [ ] No flaky timers — use Jest fake timers where needed
- [ ] Load smoke test script in `scripts/` (optional)

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

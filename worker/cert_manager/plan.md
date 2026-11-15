# Certificates Manager — implementation plan

**Service:** `cert_manager`  
**Default port:** 3137  
**Capabilities (registry):** certs, tls  
**Description:** Import PEM or mint self-signed certificates. No Let's Encrypt.

## Dependencies
- **Platform:** Conductor, worker (Docker), SQLite via `aerekos-record`

## Phase 1 — Service layout (complete)
- [x] Express app via `createManagerApp`, `/health`, `/ready`, `/api/v1/info`, `/metrics`
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] Cert items (`project_id`, `name`, `pem`, `hostnames`, `status`) via `aerekos-record`
- [x] Project scoping on all resources
- [x] `ensureDefaults` seeds `default` when empty

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README
- [x] Mint self-signed + import PEM routes
- [x] CRUD via shared `crudRouter`
- [ ] Validation (Joi or zod) — later
- [ ] Service-to-service auth middleware (conductor validate-token) — later

## Phase 4 — Worker & deployment integration
- [x] Environment contract documented in `.env_example`
- [ ] ACME / Let's Encrypt — **out of scope** (parked)

## Phase 5 — Observability
- [x] `/metrics` via `createManagerApp` / Prometheus stub
- [ ] Correlation / request IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes()` on boot (via `createManagerApp`)
- [ ] Rate limits / audit for PEM import — later

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` policy (`tests/unit/prodMockGuard.test.js`, `health.test.js`)
- [x] `mintSelfSignedPem` / `parseImportedPem` (`tests/unit/mintPem.test.js`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, `ensure-defaults` (`tests/integration/health.test.js`)
- [x] certs CRUD + mint + import against temp SQLite (`tests/integration/crud.test.js`)
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

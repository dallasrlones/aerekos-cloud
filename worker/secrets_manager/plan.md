# Secrets Manager — implementation plan

**Service:** `secrets_manager`  
**Default port:** 3107  
**Capabilities (registry):** secrets, encryption  
**Description:** Store and retrieve project-scoped secrets; envelope encryption via key_manager (AES-256-GCM).

## Dependencies
- **Platform:** Conductor, worker (Docker), key_manager (or `MOCK_KEY_MANAGER` for tests/local only)


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence (MVP complete)
- [x] `StoredSecret` in SQLite via `aerekos-record`
- [x] Project scoping (`project_id`) on all resources
- [x] Environment scoping (default `prod`)

## Phase 3 — API surface (MVP complete)
- [x] OpenAPI [`docs/openapi/secrets_manager.yaml`](../../docs/openapi/secrets_manager.yaml) + catalog/README
- [x] Validation in SecretService (name, project_id, metadata)
- [x] Create / list (redacted) / get (?reveal=1) / values map / patch / delete
- [ ] Dedicated service-token middleware beyond conductor proxy (optional hardening)

## Phase 4 — Worker & deployment integration (MVP complete)
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`
- [x] Conductor injects project secrets into enabled services (`projectSecretEnv.js`)

## Phase 5 — Observability
- [x] Prometheus metrics via shared `simplePrometheusMetrics`
- [ ] Structured JSON logging everywhere
- [ ] Correlation / request IDs

## Phase 6 — Security
- [x] `MOCK_KEY_MANAGER` refused when `NODE_ENV=production`
- [x] List never returns plaintext
- [ ] Rate limits on public routes
- [ ] Audit log for sensitive operations
- [ ] Rotation hooks (capability deferred; not in MVP registry)

---

## Testing (Wave 1 closeout)

### Unit tests
- [x] SecretService validation, SecretCrypto mock/roundtrip, SecretArn, prod-mock guard

### Integration tests
- [x] HTTP API with supertest — create/list/reveal/delete + ARN + /health|/ready|/info

### E2E tests
- [x] Process-local lifecycle in `tests/e2e/secrets-lifecycle.test.js`
- [x] Live-stack scenarios documented in `tests/e2e/README.md` (manual checklist)

### Coverage & quality gates
- [x] `npm run test:unit` / `test:integration` / `test:e2e` pass locally
- [ ] Coverage threshold formalized in CI (≥70% lines) — deferred to platform CI pass

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

# Auth Manager — implementation plan

**Service:** `auth_manager`  
**Default port:** 3116  
**Capabilities (registry):** oauth, sso_hooks, sessions  
**Description:** Optional external auth federation hooks; complements conductor JWT users.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] Define entities and storage (SQLite via `aerekos-record`: OidcProvider, Credential, User)
- [x] Project scoping (`project_id`) on CRUD resources
- [ ] Migrations tooling polish if schema evolves

## Phase 3 — API surface
- [x] OpenAPI (`api/openapi.yaml`) + route map in README
- [x] Inline validation in services (project_id, username/password rules)
- [ ] Dedicated Joi/zod schemas; service-to-service auth middleware inside the manager (conductor already gates proxy)

## Phase 4 — Worker & deployment integration
- [x] Dockerfiles / compose; health checks for orchestrator
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` via shared Prometheus helper
- [ ] Structured JSON logging
- [ ] Correlation / request IDs end-to-end

## Phase 6 — Security
- [x] Rate limits on `/auth/token` and `/auth/login`
- [x] Signing secret via secrets_manager/KMS (env fallback for boot)
- [ ] Audit log for sensitive operations; live OIDC federation with secrets_manager client_secret

---

## Testing (Wave 1 closeout)

### Unit tests
- [x] TokenService sign/verify
- [ ] Broader service-layer edge coverage

### Integration tests
- [x] Health/ready/info, providers CRUD, credentials→token, users lifecycle (supertest + temp SQLite)

### E2E tests
- [x] `tests/e2e/authFlow.test.js` in-process + live checklist in `tests/e2e/README.md`
- [ ] Live conductor/proxy CI job (optional)

### Coverage & quality gates
- [ ] `npm run test:coverage` gate (≥70%) — not enforced in Wave 1
- [x] No prod `MOCK_*` paths

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

# AI Manager — implementation plan

**Service:** `ai_manager`  
**Default port:** 3126  
**Capabilities (registry):** models, inference_hooks (+ intelligence, stt, tts, agents, connectors in catalog)  
**Description:** Model endpoints, routing, and quotas for local or remote inference; Icarus console surface.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional key_manager / db_manager / auth_manager
- **Runtime:** Ollama and/or vLLM URL for live inference; STT/TTS sidecars optional


## Phase 1 — Service layout (complete)
- [x] Express app, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose (service definition), Jest harness

## Phase 2 — Domain model & persistence
- [x] Entities via `aerekos-record` (models, providers, intelligence, agents, memory stores, …)
- [x] Project scoping (`project_id`) on product resources
- [ ] Migrations tooling polish if schema evolves

## Phase 3 — API surface
- [x] Route map in README + `docs/catalog.js` / `docs/services/ai_manager.md`
- [ ] Checked-in OpenAPI for full surface (parked — too large for Wave 2; honesty = none)
- [ ] Dedicated Joi/zod schemas across all routes

## Phase 4 — Worker & deployment integration
- [x] Image build via worker compose / ServiceManager; health checks
- [x] Environment contract documented in `.env_example`

## Phase 5 — Observability
- [x] `GET /metrics` via shared Prometheus helper
- [ ] Structured JSON logging everywhere
- [ ] Correlation / request IDs end-to-end

## Phase 6 — Security
- [x] Conductor JWT / service token on proxy (manager trusts upstream gate)
- [ ] Broader rate limits on public/chat routes
- [ ] Audit polish for connector secrets (secret_ref only)

---

## Testing (Wave 2 closeout)

### Unit tests
- [x] Scoped: `LocalIntegrationSeed.localDefaults` + default port (`tests/unit/health.test.js`)
- [ ] Full `tests/unit/*` ocean (Icarus/agents/voice) — exists; not Wave 2 gate

### Integration tests
- [x] Health/ready/info + models CRUD (supertest + temp SQLite)

### E2E tests
- [x] Live checklist in `tests/e2e/README.md`
- [ ] Live conductor/proxy CI job (optional; needs fleet + keys)

### Coverage & quality gates
- [ ] `npm run test:coverage` gate (≥70%) — not enforced in Wave 2
- [x] No prod `MOCK_*` inference paths

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

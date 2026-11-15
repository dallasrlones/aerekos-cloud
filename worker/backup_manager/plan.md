# Backup Manager — implementation plan

**Service:** `backup_manager`  
**Default port:** 3134  
**Capabilities (registry):** backup, restore  
**Description:** Vault CRUD + snapshot jobs into `aerekos-backups`; restore via source adapters.

## Dependencies
- **Platform:** Conductor, storage_manager (bucket), optional db/git/secrets/logs/audit managers for adapters

## Phase 1 — Service layout (complete)
- [x] Express app via `createManagerApp`, /health, /ready, /api/v1/info
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, Jest harness

## Phase 2 — Domain model & persistence (complete for MVP)
- [x] Vaults via `aerekos-record` + project scoping
- [x] Jobs metadata + snapshot objects in storage

## Phase 3 — API surface (complete for MVP)
- [x] OpenAPI / route map in README
- [x] Vaults CRUD + jobs create/list/get/restore
- [x] Service-to-service auth via conductor proxy

## Phase 4 — Adapters & scheduler (MVP)
- [x] Source adapters (storage/db/secrets/git/logs/audit/generic)
- [x] Optional cron scheduler (`SKIP_BACKUP_CRON` to disable)
- [ ] Multi-region / AWS Backup parity — out of scope

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via bootstrap)
- [ ] Correlation / request IDs — later

## Phase 6 — Security
- [x] No prod skip-fakes (`assertNoSkipFakes` via `createManagerApp`)
- [x] Secrets adapter never uses `reveal=1`
- [ ] Rate limits / iam deep integration — later

---

## Testing (Wave 4 closeout)

### Unit tests
- [x] `cronMatch` + gitSource helpers
- [x] Prod mock guard / `assertNoSkipFakes` policy

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, ensure-defaults
- [x] vaults CRUD against temp SQLite
- [x] jobs snapshot + restore with mocked storage axios
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

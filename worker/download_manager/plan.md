# Download Manager — implementation plan

**Service:** `download_manager`  
**Default port:** 3133  
**Capabilities (registry):** download, torrent, yt-dlp  
**Description:** Project-scoped download lists/items with qBittorrent + Jackett/tor-dl search + yt-dlp; MediaConvert naming analog only.

## Dependencies
- **Platform:** Conductor, worker (Docker), optional storage_manager for bucket upload
- **Optional live:** qBittorrent (`QBITTORRENT_URL`), yt-dlp binary, network egress for search/fetch

## Phase 1 — Service layout (complete)
- [x] Express app via `createManagerApp`, /health, /ready, /api/v1/info, /metrics
- [x] Error middleware, conductor registration helper
- [x] Dockerfiles, docker-compose.download, Jest harness

## Phase 2 — Domain model & persistence
- [x] DownloadList / DownloadItem / DownloadWindow / Indexer via SQLite (`aerekos-record`)
- [x] Project scoping (`project_id`) on all resources
- [x] `system_id` migration for system-bucket uploads
- [ ] Richer schema / migrations tooling — later

## Phase 3 — API surface
- [x] OpenAPI / route map in README + `api/openapi.yaml`
- [x] lists/items/windows/indexers CRUD + quick-add / search / tick / pause|resume|retry
- [ ] Service-to-service auth middleware (conductor validate-token) — later (proxy JWT today)

## Phase 4 — Worker & deployment integration
- [x] Image build via worker `ServiceManager`; health checks for orchestrator
- [x] Environment contract documented in `.env_example`
- [x] In-process ticker (`DISABLE_TICKER=1` to disable)

## Phase 5 — Observability
- [x] `GET /metrics` (Prometheus via `createManagerApp`)
- [ ] Structured JSON logging / correlation IDs — later

## Phase 6 — Security
- [x] `assertNoSkipFakes({ extra: ['SKIP_TORRENT'] })` on boot (`SKIP_DOWNLOAD` in shared defaults; also via `createManagerApp`)
- [ ] Rate limits / audit / iam hooks — later

---

## Testing (Wave 5 closeout)

### Unit tests
- [x] Prod mock guard / `assertNoSkipFakes` + `SKIP_DOWNLOAD` / `SKIP_TORRENT` policy (`tests/unit/`)

### Integration tests
- [x] `/health`, `/ready`, `/api/v1/info`, ensure-defaults (`tests/integration/health.test.js`)
- [x] lists CRUD (`tests/integration/crud.test.js`)
- [x] windows + quick-add + tick under `SKIP_DOWNLOAD` (`tests/integration/windows.test.js`)
- [x] Conductor registration skipped via `SKIP_SERVICE_REGISTRATION`

### E2E tests
- [x] Scenarios documented in `tests/e2e/README.md` (live proxy parked until conductor stack up)
- [ ] Live conductor proxy + qBittorrent / yt-dlp checklist executed when stack available

### Coverage & quality gates
- [x] `npm test` (unit + integration) green for closeout gate
- [ ] Optional coverage threshold / load smoke — later

---

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)
- [download_manager_qbit_fix.md](../../docs/plans/download_manager_qbit_fix.md)

# download_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `download_manager` on a non-prod project (and optional qBittorrent / yt-dlp for live download). Root `e2e/catalog.js` already lists CRUD for `download_manager` / `lists` on port `3133`.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist (when stack up)

- [ ] **E2E-1:** `GET /health` → 200
- [ ] **E2E-2:** Conductor proxy `/api/services/download_manager/api/v1/info` → 200
- [ ] **E2E-3:** lists CRUD + ensure-defaults on a non-prod project
- [ ] **E2E-4:** quick-add + tick (live engines or accept SKIP flags only in non-prod)
- [ ] **E2E-5:** SDK `client.resource('download_manager', 'lists')` / CLI against non-prod

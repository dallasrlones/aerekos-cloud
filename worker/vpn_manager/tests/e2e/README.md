# vpn_manager e2e

In-process coverage lives under `tests/integration` and `tests/unit` (`npm test`).

**Live conductor/proxy:** not run in this closeout — needs a running conductor + enabled `vpn_manager` on a non-prod project. Root `e2e/catalog.js` already lists CRUD for `vpn_manager` / `peers` on port `3147`.

**Headscale live path:** parked without `HEADSCALE_URL` + `HEADSCALE_API_KEY`. Without those, `GET /api/v1/status` reports `hooked_up: false` and `POST /api/v1/preauth-keys` returns 503 — that honesty is covered by integration tests.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist (when stack is up)

- [ ] **E2E-1:** `GET /health` → 200
- [ ] **E2E-2:** Conductor proxy `/api/services/vpn_manager/api/v1/info` → 200
- [ ] **E2E-3:** Peers CRUD on a non-prod project
- [ ] **E2E-4:** With Headscale env set, `POST /api/v1/preauth-keys` returns a real key (optional)

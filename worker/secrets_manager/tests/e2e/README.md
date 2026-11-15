# E2E tests — Secrets Manager

## Automated (CI / local)

```bash
npm run test:e2e
```

Runs `tests/e2e/secrets-lifecycle.test.js` against the exported Express app with `MOCK_KEY_MANAGER=true` (see `tests/setup.js`). Covers create → list (redacted) → values map → reveal → patch → delete, plus `/health` and `/api/v1/info`.

**Does not** hit a live conductor or production projects. Do not use project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` in any live e2e.

## Live stack (manual checklist)

Prerequisites: conductor + worker running; service registered (or `CONDUCTOR_URL` set).

- [ ] **E2E-live-1:** `GET /health` on the secrets_manager container returns 200.
- [ ] **E2E-live-2:** Conductor lists `secrets_manager`; proxy `/api/services/secrets_manager/api/v1/info` works with JWT/service token.
- [ ] **E2E-live-3:** Create + list + reveal through the conductor proxy for a **non-prod** project.
- [ ] **E2E-live-4:** With `NODE_ENV=production`, process refuses to start if `MOCK_KEY_MANAGER=true`.

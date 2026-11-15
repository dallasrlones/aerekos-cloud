# E2E tests — Auth Manager

## Automated (Jest)

```bash
cd worker/auth_manager
npm run test:e2e
# or: npm test  (includes tests/e2e/*.test.js)
```

`authFlow.test.js` runs the real Express app in-process (SQLite): health/ready, OIDC provider CRUD, app credential → `client_credentials` token → verify, user create → login → verify → cleanup.

## Live stack (manual / CI job)

- **E2E-live-1:** Start `auth_manager` container; `GET /health` on the Docker network returns 200.
- **E2E-live-2:** Conductor `GET /api/services/auth_manager/health` (no project_id) and proxy `/api/services/auth_manager/api/v1/...` with JWT or service token.
- **E2E-live-3:** `POST .../api/v1/auth/token` without inbound Bearer (conductor special-case) issues an app or `conductor` client token.
- **E2E-live-4:** Signing secret from key_manager (`auth_manager.signing_secret`) matches conductor JWT verification.

## Notes

- OIDC provider rows are **metadata only** — live IdP federation needs `client_secret` in secrets_manager (not stored here).
- No production mocks; tests use a local SQLite file and `AUTH_MANAGER_SECRET` env for signing.

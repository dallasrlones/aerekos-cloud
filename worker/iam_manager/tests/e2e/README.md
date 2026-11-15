# E2E tests — IAM Manager

## Automated (local)

```bash
cd worker/iam_manager
npm run test:e2e
```

Runs `iamFlow.test.js` against the Express app with a temp SQLite DB (`tests/setup.js`). Covers health → create policy/role → attach → evaluate allow/deny → cleanup. No conductor required.

## Live stack (platform)

When conductor + worker are up:

- `e2e/tier6-app-access.js` — policy evaluate allow/deny through the conductor proxy
- `e2e/wave2-tunnel-compute-iam.js` — IAM evaluate smoke via SDK `client.proxy`

## Manual checklist (optional ops)

- [ ] **E2E-M1:** Container `GET /health` on the worker Docker network returns 200
- [ ] **E2E-M2:** Conductor registry lists `iam_manager`; proxy path works with JWT
- [ ] **E2E-M3:** With `IAM_ENFORCE_PROXY=true`, denied actions return 403 `IamDenied`

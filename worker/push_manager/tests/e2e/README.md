# E2E — push_manager

## Automated (repo root)

Root suite may include this manager in `e2e/catalog.js` (subscriptions CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `push_manager`; proxy `/api/services/push_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create subscription → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/send` with `FCM_SERVER_KEY` delivers (or documents queue-only without keys)
- [ ] **E2E-5:** SDK `client.resource('push_manager', 'subscriptions')` / CLI `aerekos push_manager subscriptions …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/push_manager
npm test
```

**Parked:** live conductor proxy e2e and live FCM send. Blockers: conductor + enabled `push_manager` on a non-prod project; `FCM_SERVER_KEY` (and device token) required for real delivery — without secrets, send stays queue-only (`needs-keys`).

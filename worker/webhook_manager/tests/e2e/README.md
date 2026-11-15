# E2E — webhook_manager

## Automated (repo root)

When the root suite lists this manager in `e2e/catalog.js`, run:

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `webhook_manager`; proxy `/api/services/webhook_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create webhook → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/dispatch` with `SKIP_OUTBOUND` unset hits a reachable `target_url` and records `mode: live`
- [ ] **E2E-5:** SDK `client.proxy` / CLI `aerekos call` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/webhook_manager
npm test
```

**Parked:** live proxy e2e needs conductor + enabled `webhook_manager` on a non-prod project. Live outbound needs a reachable `target_url` (local/CI uses `SKIP_OUTBOUND=1`). Not an inbound webhook receiver.

# E2E — iot_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (things CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `iot_manager`; proxy `/api/services/iot_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create thing → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/publish` fans out (or documents skip) with conductor + `websocket_manager` enabled
- [ ] **E2E-5:** SDK `client.resource('iot_manager', 'things')` / CLI `aerekos iot_manager things …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/iot_manager
npm test
```

Live proxy e2e needs conductor + enabled `iot_manager` on a non-prod project. MQTT broker / device twin sync remains parked.

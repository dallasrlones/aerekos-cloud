# E2E — transfer_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (endpoints CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `transfer_manager`; proxy `/api/services/transfer_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create endpoint → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** With `storage_manager` + conductor up, `POST …/endpoints/:id/put` then `…/get` round-trips object bytes
- [ ] **E2E-5:** SDK `client.resource('transfer_manager', 'endpoints')` / CLI `aerekos transfer_manager endpoints …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/transfer_manager
npm test
```

**Parked:** live proxy e2e needs conductor + enabled `transfer_manager` + `storage_manager` on a non-prod project. Put/get are object copies via storage_manager — **not** a live SFTP daemon (Transfer Family naming analog only).

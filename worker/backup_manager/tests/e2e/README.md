# E2E — backup_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (vaults CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `backup_manager`; proxy `/api/services/backup_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create vault → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/jobs` (storage_manager source) → get job + signed URL → restore against a non-prod project
- [ ] **E2E-5:** SDK `client.resource('backup_manager', 'vaults')` / CLI `aerekos backup_manager vaults …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/backup_manager
npm test
```

Live proxy e2e needs conductor + enabled `backup_manager` + `storage_manager` on a non-prod project.

# E2E — status_manager

## Automated (repo root)

Root suite lists this manager in `e2e/catalog.js` (incidents CRUD via conductor proxy on port `3150`):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `status_manager`; proxy `/api/services/status_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create incident → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `GET …/api/v1/public?project_id=` returns `ok` / `degraded` via proxy
- [ ] **E2E-5:** SDK `client.resource('status_manager', 'incidents')` / CLI `aerekos status_manager incidents …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/status_manager
npm test
```

**Live conductor/proxy e2e:** parked for this closeout — needs a running conductor + enabled `status_manager` on a non-prod project. Statuspage is a naming analog only; runtime is SQLite incidents + local public aggregate. No production skip-fakes.

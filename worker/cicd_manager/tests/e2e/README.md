# E2E — cicd_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (pipelines CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `cicd_manager`; proxy `/api/services/cicd_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create pipeline → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/pipelines/:id/run` (test action) and/or `POST …/pipelines/run-for-repo` against a non-prod project
- [ ] **E2E-5:** SDK `client.resource('cicd_manager', 'pipelines')` / CLI `aerekos cicd_manager pipelines …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/cicd_manager
npm test
```

Live proxy e2e needs conductor + enabled `cicd_manager` on a non-prod project.

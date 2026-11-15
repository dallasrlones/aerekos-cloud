# E2E — notebook_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (notebooks CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `notebook_manager`; proxy `/api/services/notebook_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create notebook → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/notebooks/:id/run` creates a compute_manager oneshot when conductor + `compute_manager` are up
- [ ] **E2E-5:** SDK `client.resource('notebook_manager', 'notebooks')` / CLI against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/notebook_manager
npm test
```

## Parked / blockers

Live conductor proxy e2e needs the full stack (conductor + enabled `notebook_manager` + `compute_manager` for run). Without `CONDUCTOR_URL`, run records `status: queued` honestly — that path is covered by integration tests. Jupyter/lab image execution beyond compute oneshot dispatch remains parked.

# E2E — cert_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (certs CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `cert_manager`; proxy `/api/services/cert_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create cert → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/certs/mint` and `POST …/certs/import` against a non-prod project
- [ ] **E2E-5:** SDK `client.resource('cert_manager', 'certs')` / CLI `aerekos cert_manager certs …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/cert_manager
npm test
```

Live proxy e2e needs conductor + enabled `cert_manager` on a non-prod project.

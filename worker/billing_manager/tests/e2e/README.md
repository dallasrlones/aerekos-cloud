# E2E — billing_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (meters CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `billing_manager`; proxy `/api/services/billing_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create meter → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/evaluate-quota` denies when over limit and never returns `unlimited: true`
- [ ] **E2E-5:** SDK `client.resource('billing_manager', 'meters')` / CLI `aerekos billing_manager meters …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/billing_manager
npm test
```

Live proxy e2e needs conductor + enabled `billing_manager` on a non-prod project.

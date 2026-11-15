# E2E — code_as_infra

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`modules` CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `code_as_infra`; proxy `/api/services/code_as_infra/api/v1/info` → 200
- [ ] **E2E-3:** Create module → get → patch → list → delete
- [ ] **E2E-4:** SDK `client.resource('code_as_infra', 'modules')` / `aerekos call` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/code_as_infra
npm test
```

Live proxy e2e needs conductor + enabled `code_as_infra` on a non-prod project — **parked** until stack is up.

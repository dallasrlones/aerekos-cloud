# E2E — config_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`namespaces` CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
# or a focused catalog runner if available in CI
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `config_manager`; proxy `/api/services/config_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create namespace → evaluate flag → update flags → evaluate again → delete
- [ ] **E2E-4:** `POST /api/v1/ensure-defaults` seeds `app` / `{ example: false }` on empty project
- [ ] **E2E-5:** SDK `client.config.evaluate` / CLI `aerekos config_manager namespaces …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/config_manager
npm test
```

# E2E — vector_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`indexes` CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `vector_manager`; proxy `/api/services/vector_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create index → upsert vectors → query → delete index
- [ ] **E2E-4:** `POST /api/v1/ensure-defaults` seeds `rag` on empty project
- [ ] **E2E-5:** SDK `client.resource('vector_manager','indexes')` / CLI `aerekos vector_manager indexes …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/vector_manager
npm test
```

Live conductor/proxy upsert→db_manager is optional and parked when stack is down.

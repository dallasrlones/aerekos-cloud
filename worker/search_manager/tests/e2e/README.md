# E2E — search_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (indexes CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `search_manager`; proxy `/api/services/search_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create index → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/index` then `POST …/query` returns real FTS hits (not empty-only stubs)
- [ ] **E2E-5:** SDK `client.resource('search_manager', 'indexes')` / CLI `aerekos search_manager indexes …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/search_manager
npm test
```

**Parked:** live proxy e2e needs conductor + enabled `search_manager` on a non-prod project. This manager is SQLite FTS5 only — not a full OpenSearch cluster.

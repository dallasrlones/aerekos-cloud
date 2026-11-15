# E2E — graphql_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (apis CRUD via conductor proxy) and `e2e/wave-data-graphql.js` (compile/execute flow):

```bash
# from repo root, stack up
make e2e
# or
node e2e/wave-data-graphql.js
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `graphql_manager`; proxy `/api/services/graphql_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create api → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/compile` then `POST …/execute` against api_manager Data API on a non-prod project
- [ ] **E2E-5:** SDK `client.resource('graphql_manager', 'apis')` / CLI `aerekos graphql_manager apis …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/graphql_manager
npm test
```

Live proxy e2e needs conductor + enabled `graphql_manager` + `api_manager` on a non-prod project.

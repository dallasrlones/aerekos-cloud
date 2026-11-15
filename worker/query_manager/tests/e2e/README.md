# E2E — query_manager

## Automated (repo root)

Root suite lists this manager in `e2e/catalog.js` (queries CRUD via conductor proxy on port `3145`):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `query_manager`; proxy `/api/services/query_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create query → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/api/v1/sql` runs `SELECT 1` against per-project SQLite via proxy
- [ ] **E2E-5:** SDK `client.resource('query_manager', 'queries')` / CLI `aerekos query_manager queries …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/query_manager
npm test
```

**Live conductor/proxy e2e:** parked for this closeout — needs a running conductor + enabled `query_manager` on a non-prod project. Athena / DuckDB lake query is a naming analog only; runtime SQL is better-sqlite3 per project file. `SKIP_DUCKDB` is test/dev only (refused in production).

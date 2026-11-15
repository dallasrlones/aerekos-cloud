# E2E — logs_manager

## Automated (repo root)

Root `e2e/catalog.js` lists port `3104` for `logs_manager`. Live CRUD via conductor proxy is **parked** until the stack is up (no dedicated CRUD round-trip entry yet — use proxy/`aerekos call`).

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `logs_manager`; proxy `/api/services/logs_manager/api/v1/info` → 200
- [ ] **E2E-3:** `POST /api/v1/logs` → `GET /api/v1/logs` → `GET /api/v1/logs/:id` on a non-prod project
- [ ] **E2E-4:** `POST /api/v1/logs/batch` (worker outbox shape) → query by `source` / `q` / `level`
- [ ] **E2E-5:** SDK `client.proxy('logs_manager', …)` / CLI `aerekos call logs_manager …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/logs_manager
npm test
```

Live proxy e2e needs conductor + enabled `logs_manager` on a non-prod project.

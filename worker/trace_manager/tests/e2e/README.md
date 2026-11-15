# E2E — trace_manager

## Automated (repo root)

Root `e2e/catalog.js` lists port `3143` for `trace_manager` (traces CRUD via conductor proxy). Live proxy e2e is **parked** until the stack is up.

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Blockers (honest)

- Live conductor proxy e2e needs conductor + enabled `trace_manager` on a non-prod project.
- Full X-Ray / Jaeger / Tempo backends, sampling, and remote collectors are out of scope for MVP (local SQLite + OTLP/HTTP only).

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `trace_manager`; proxy `/api/services/trace_manager/api/v1/info` → 200
- [ ] **E2E-3:** `POST /api/v1/traces` → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST /v1/traces` OTLP ingest → `GET /api/v1/spans` / `GET /api/v1/query`
- [ ] **E2E-5:** SDK `client.resource('trace_manager', 'traces')` / CLI `aerekos call trace_manager …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/trace_manager
npm test
```

Live proxy e2e needs conductor + enabled `trace_manager` on a non-prod project.

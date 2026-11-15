# E2E — metrics_manager

## Automated (repo root)

Root `e2e/catalog.js` lists port `3105` for `metrics_manager`. Live CRUD via conductor proxy is **parked** until the stack is up (use proxy / `aerekos call`).

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Blockers (honest)

- Live conductor proxy e2e needs conductor + enabled `metrics_manager` on a non-prod project.
- Alarm → `event_manager` publish needs `CONDUCTOR_URL` + token and `event_manager` reachable; park with `SKIP_OUTBOUND=1` in local tests.
- Aggregation cluster / Prometheus federation is out of scope for MVP.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `metrics_manager`; proxy `/api/services/metrics_manager/api/v1/info` → 200
- [ ] **E2E-3:** `POST /api/v1/series` → `GET /api/v1/series` → `GET /api/v1/series/:id` on a non-prod project
- [ ] **E2E-4:** `POST /api/v1/alarms` → `POST /api/v1/alarms/evaluate` (with/without outbound)
- [ ] **E2E-5:** SDK `client.resource('metrics_manager', 'series')` / CLI `aerekos call metrics_manager …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/metrics_manager
npm test
```

Live proxy e2e needs conductor + enabled `metrics_manager` on a non-prod project.

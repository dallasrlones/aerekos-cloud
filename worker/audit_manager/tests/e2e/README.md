# E2E — audit_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`events` CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `audit_manager`; proxy `/api/services/audit_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create event → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST /api/v1/ingest` with actor/action/detail creates an event
- [ ] **E2E-5:** SDK `client.resource('audit_manager', 'events')` / CLI `aerekos audit_manager events …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/audit_manager
npm test
```

Live proxy e2e needs conductor + enabled `audit_manager` on a non-prod project.

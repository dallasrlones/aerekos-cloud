# E2E — system_manager

## Automated (repo root)

Root suite lists this manager in `e2e/catalog.js` (tasks CRUD via conductor proxy on port `3127`):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `system_manager`; proxy `/api/services/system_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create task → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `GET/POST …/api/v1/hosts/:workerId/check` against a live online worker via conductor
- [ ] **E2E-5:** `POST …/hosts/:workerId/update` with `{ target: "docker"|"os" }` on a non-prod worker (privileged)
- [ ] **E2E-6:** SDK `client.resource('system_manager', 'tasks')` / CLI `aerekos system_manager tasks …`

## Local smoke (integration-level)

```bash
cd worker/system_manager
npm test
```

**Live conductor/proxy e2e:** parked for this closeout — needs a running conductor, an enabled/online worker, and `system_manager` registered. Host check/update is a **conductor proxy** to `/api/workers/:id/host/*` (real probe on the worker via `hostPatch`; `SKIP_HOST_PATCH` is worker test/dev only and refused in production). Task `POST …/tasks/:id/run` needs `spec_json.image` (compute_manager) or `spec_json.url` and a reachable conductor/compute path.

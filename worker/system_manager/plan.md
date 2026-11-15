# System Manager — implementation plan

**Service:** `system_manager`  
**Default port:** 3127  
**Capabilities (registry):** maintenance, tasks  
**Description:** Maintenance task specs + host OS/Docker check/update (proxied to conductor; privileged ops on worker).

## Wave 7 closeout (done)

- [x] `createManagerApp` + honest `/health` `/ready` `/metrics` (SQLite)
- [x] `assertNoSkipFakes` on boot (includes `SKIP_HOST_PATCH`)
- [x] Tasks CRUD + `POST …/tasks/:id/run` (image→compute / url HTTP)
- [x] Hosts proxy to conductor `/api/workers/:id/host/*` with status forwarding + 503 on throw
- [x] Unit + integration tests (`npm test`); live conductor e2e parked
- [x] OpenAPI pack + catalog / MANAGER_SERVICES / docs honesty

## Dependencies
- **Platform:** Conductor, worker (`hostPatch`), optional compute_manager for task `run` with `image`

## Follow-ups (parked)
- Live conductor + online worker e2e for host check/update
- Privileged update safety / confirm gates beyond conductor auth
- Optional `ensure-defaults` seed for sample task

## References
- [new_service.md](../../new_service.md)
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

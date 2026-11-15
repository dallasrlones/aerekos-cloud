# App Manager — implementation plan

**Service:** `app_manager`  
**Default port:** 3125  
**Capabilities (registry):** apps, deploys, scaffold  
**Description:** Project-scoped app metadata + FE scaffold for Icarus IDE. Deploy remains compute/cicd/tunnel.

## Wave 3 closeout (done)

- [x] Express `/health`, `/ready`, `/metrics`, `/api/v1/info`
- [x] SQLite CRUD via `aerekos-record` + `POST /apps/scaffold` (metadata JSON honesty)
- [x] OpenAPI (`api/openapi.yaml` + `docs/openapi/app_manager.yaml`)
- [x] README + `docs/services` honesty; SDK/CLI generic only; tutorial none
- [x] Unit + integration tests (`npm test`); live conductor proxy e2e parked

## Remaining (post-closeout / later waves)

- [ ] Wire scaffold files into git_manager / Icarus IDE write path
- [ ] Service-to-service auth middleware (conductor validate-token)
- [ ] Rate limits / audit hooks as needed

## Testing (Wave 3 closeout)

| Layer | Command |
|-------|---------|
| Unit | `npm run test:unit` |
| Integration | `npm run test:integration` |
| Live e2e | parked — needs conductor |

## References
- [new_service.md](../../new_service.md)
- [docs/services/app_manager.md](../../docs/services/app_manager.md)

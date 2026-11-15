# Code as Infra — implementation plan

**Service:** `code_as_infra`  
**Default port:** 3120  
**Capabilities (registry):** iac, declarative / modules  
**Description:** Project-scoped IaC modules / snippets (kind + content). Storage only — no apply/plan engine. CloudFormation naming analog.

## Wave 3 closeout (done)

- [x] Express `/health`, `/ready`, `/metrics`, `/api/v1/info`
- [x] SQLite CRUD via `aerekos-record` on `/api/v1/modules` (no apply engine)
- [x] OpenAPI (`api/openapi.yaml` + `docs/openapi/code_as_infra.yaml`)
- [x] README + `docs/services` honesty; SDK/CLI generic only; tutorial none
- [x] Unit + integration tests (`npm test`); live conductor proxy e2e parked

## Remaining (post-closeout / later waves)

- [ ] Apply / plan engine (or fold into conductor stack revision APIs)
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
- [docs/services/code_as_infra.md](../../docs/services/code_as_infra.md)

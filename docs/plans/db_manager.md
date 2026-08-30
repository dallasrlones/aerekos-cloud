# db_manager — production plan

**Port:** 3004 · **AWS analog:** RDS · **Category:** Core · **Tier:** production-ready

**Navigation:** [← storage_manager](./storage_manager.md) · [Index](./README.md) · [compute_manager →](./compute_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Provision DB containers (PG, Redis, Mongo, Neo4j, ES, SQLite), backups.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | DatabaseManager (bespoke) |
| Tests | Per-engine integration (strong) |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- Connection endpoint exposes credentials
- PROJECT_ID env on worker deploy
- Mixed auth middleware

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:db:database/{name}` |
| Scopes | db:Connect, db:Query, db:Admin |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup db_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos db_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info db_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on database provision
- [ ] App scope db:Connect — connection info only with matching ARN
- [ ] Unify auth on requireAuth (drop JWT fallback)
- [ ] Backup schedule automation
- [ ] Redact passwords in logs

---

## Links

- Worker scaffold: [worker/db_manager/plan.md](../../worker/db_manager/plan.md)
- Service doc: [docs/services/db_manager.md](../services/db_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

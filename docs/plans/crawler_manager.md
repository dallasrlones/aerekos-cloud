# crawler_manager — production plan

**Port:** 3121 · **AWS analog:** Glue Crawler · **Category:** AI · **Tier:** stub-deferred

**Navigation:** [← code_as_infra](./code_as_infra.md) · [Index](./README.md) · [app_manager →](./app_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Crawl job metadata — DEFERRED execution until after core platform.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub-deferred |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No HTTP fetch — deferred

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup crawler_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos crawler_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info crawler_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] DEFERRED: HTTP fetch worker
- [ ] Now: catalog stub; CLI CRUD parity for job metadata

---

## Links

- Worker scaffold: [worker/crawler_manager/plan.md](../../worker/crawler_manager/plan.md)
- Service doc: [docs/services/crawler_manager.md](../services/crawler_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

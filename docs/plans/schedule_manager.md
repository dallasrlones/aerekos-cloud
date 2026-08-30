# schedule_manager — production plan

**Port:** 3102 · **AWS analog:** EventBridge Scheduler · **Category:** Compute · **Tier:** production-ready

**Navigation:** [← logs_manager](./logs_manager.md) · [Index](./README.md) · [network_manager →](./network_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Cron schedules dispatching to webhook or queue.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole |
| Tests | api.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- SKIP_CRON disables loop
- Single-node scheduler

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup schedule_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos schedule_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info schedule_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Leader election for multi-conductor cron
- [ ] requireAuth on CRUD
- [ ] Validate dispatch targets exist (webhook/queue ARN)

---

## Links

- Worker scaffold: [worker/schedule_manager/plan.md](../../worker/schedule_manager/plan.md)
- Service doc: [docs/services/schedule_manager.md](../services/schedule_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

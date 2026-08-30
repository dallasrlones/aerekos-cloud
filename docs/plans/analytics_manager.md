# analytics_manager — production plan

**Port:** 3117 · **AWS analog:** Pinpoint · **Category:** Observability · **Tier:** stub

**Navigation:** [← security_manager](./security_manager.md) · [Index](./README.md) · [balancer_manager →](./balancer_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Product analytics event rows.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud + e2e SDK |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No pipeline or dashboards

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup analytics_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos analytics_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info analytics_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Batch ingest API
- [ ] Export to storage_manager
- [ ] Or integrate external analytics

---

## Links

- Worker scaffold: [worker/analytics_manager/plan.md](../../worker/analytics_manager/plan.md)
- Service doc: [docs/services/analytics_manager.md](../services/analytics_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

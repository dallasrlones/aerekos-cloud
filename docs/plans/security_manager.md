# security_manager — production plan

**Port:** 3108 · **AWS analog:** Security Hub · **Category:** Observability · **Tier:** stub

**Navigation:** [← metrics_manager](./metrics_manager.md) · [Index](./README.md) · [analytics_manager →](./analytics_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Security finding records only.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No scanners or CSPM

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup security_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos security_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info security_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Wire findings from conductor audit
- [ ] Severity routing to webhook_manager
- [ ] Or mark stub in catalog

---

## Links

- Worker scaffold: [worker/security_manager/plan.md](../../worker/security_manager/plan.md)
- Service doc: [docs/services/security_manager.md](../services/security_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

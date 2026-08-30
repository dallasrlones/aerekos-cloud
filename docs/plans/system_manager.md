# system_manager — production plan

**Port:** 3127 · **AWS analog:** Systems Manager · **Category:** Platform · **Tier:** stub

**Navigation:** [← worker_manager](./worker_manager.md) · [Index](./README.md) · —  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Maintenance task specs — no execution.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No host command execution

## App access

**Candidate:** Admin-only — conductor user JWT or service token. No app credentials.



## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup system_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos system_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info system_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] SSM-style agent on workers
- [ ] Execute via worker socket

---

## Links

- Worker scaffold: [worker/system_manager/plan.md](../../worker/system_manager/plan.md)
- Service doc: [docs/services/system_manager.md](../services/system_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

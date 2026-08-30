# sms_manager — production plan

**Port:** 3114 · **AWS analog:** SNS SMS · **Category:** Integrations · **Tier:** stub-deferred

**Navigation:** [← email_manager](./email_manager.md) · [Index](./README.md) · [slack_manager →](./slack_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Queued SMS rows — DEFERRED until Twilio/SNS keys.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub-deferred |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No provider — deferred

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup sms_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos sms_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info sms_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] DEFERRED: Twilio integration
- [ ] Now: catalog stub; CLI CRUD parity for queue rows

---

## Links

- Worker scaffold: [worker/sms_manager/plan.md](../../worker/sms_manager/plan.md)
- Service doc: [docs/services/sms_manager.md](../services/sms_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

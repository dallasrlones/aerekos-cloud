# slack_manager — production plan

**Port:** 3115 · **AWS analog:** Chatbot · **Category:** Integrations · **Tier:** stub-deferred

**Navigation:** [← sms_manager](./sms_manager.md) · [Index](./README.md) · [cicd_manager →](./cicd_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Queued Slack posts — DEFERRED until Slack bot token.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub-deferred |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No Slack API — deferred

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup slack_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos slack_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info slack_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] DEFERRED: Slack Web API
- [ ] Now: catalog stub; CLI CRUD parity

---

## Links

- Worker scaffold: [worker/slack_manager/plan.md](../../worker/slack_manager/plan.md)
- Service doc: [docs/services/slack_manager.md](../services/slack_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

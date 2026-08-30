# email_manager — production plan

**Port:** 3113 · **AWS analog:** SES · **Category:** Integrations · **Tier:** stub-deferred

**Navigation:** [← cdn_manager](./cdn_manager.md) · [Index](./README.md) · [sms_manager →](./sms_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Queued email rows — DEFERRED until SMTP/SES keys in secrets_manager.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub-deferred |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No SMTP integration — deferred per enterprise_standards.md

## App access

**Candidate:** No / internal / future.

Future ARN: `arn:aerekos:{pid}:email:identity/{name} (future)`

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup email_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos email_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info email_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] DEFERRED: SMTP send — see enterprise_standards.md
- [ ] Now: mark catalog status stub/needs-keys; console "Connect provider" placeholder
- [ ] Now: CLI parity for metadata CRUD (list/create/delete queued rows)
- [ ] Now: OpenAPI + docs honesty

---

## Links

- Worker scaffold: [worker/email_manager/plan.md](../../worker/email_manager/plan.md)
- Service doc: [docs/services/email_manager.md](../services/email_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

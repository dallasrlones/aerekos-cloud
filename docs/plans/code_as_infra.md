# code_as_infra — production plan

**Port:** 3120 · **AWS analog:** CloudFormation · **Category:** Dev tools · **Tier:** stub

**Navigation:** [← cicd_manager](./cicd_manager.md) · [Index](./README.md) · [crawler_manager →](./crawler_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

IaC snippet blobs.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No apply/plan engine

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup code_as_infra --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos code_as_infra …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info code_as_infra` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Terraform/Pulumi runner via compute_manager
- [ ] State in storage_manager

---

## Links

- Worker scaffold: [worker/code_as_infra/plan.md](../../worker/code_as_infra/plan.md)
- Service doc: [docs/services/code_as_infra.md](../services/code_as_infra.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

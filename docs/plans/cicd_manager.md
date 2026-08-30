# cicd_manager — production plan

**Port:** 3119 · **AWS analog:** CodePipeline · **Category:** Dev tools · **Tier:** stub

**Navigation:** [← slack_manager](./slack_manager.md) · [Index](./README.md) · [code_as_infra →](./code_as_infra.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Pipeline JSON definitions — no runners.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No build execution

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup cicd_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos cicd_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info cicd_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] GitHub Actions / compute_manager runner integration
- [ ] Artifact storage via storage_manager

---

## Links

- Worker scaffold: [worker/cicd_manager/plan.md](../../worker/cicd_manager/plan.md)
- Service doc: [docs/services/cicd_manager.md](../services/cicd_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

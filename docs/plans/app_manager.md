# app_manager — production plan

**Port:** 3125 · **AWS analog:** Amplify / App Runner · **Category:** Dev tools · **Tier:** stub

**Navigation:** [← crawler_manager](./crawler_manager.md) · [Index](./README.md) · [mcp_manager →](./mcp_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

App metadata (repo_url, build_command).

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No deploy integration

## App access

**Candidate:** No / internal / future.

Future ARN: `arn:aerekos:{pid}:app:application/{name} (future)`

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup app_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos app_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info app_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Link to git_manager + cicd_manager
- [ ] Deploy via compute_manager
- [ ] Public URL via tunnel_manager

---

## Links

- Worker scaffold: [worker/app_manager/plan.md](../../worker/app_manager/plan.md)
- Service doc: [docs/services/app_manager.md](../services/app_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

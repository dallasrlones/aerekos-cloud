# compute_manager — production plan

**Port:** 3100 · **AWS analog:** ECS / Fargate · **Category:** Compute · **Tier:** production-ready

**Navigation:** [← db_manager](./db_manager.md) · [Index](./README.md) · [queue_manager →](./queue_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Docker task runner: create/stop/delete project-scoped containers.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ComputeManager (bespoke) |
| Tests | api.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No manager-edge auth
- SKIP_DOCKER metadata-only mode
- No fleet placement

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:compute:task/{name}` |
| Scopes | compute:Run, compute:Stop, compute:Describe |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup compute_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos compute_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info compute_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on task template / named task profiles
- [ ] requireAuth on all routes
- [ ] requireResource for run/stop
- [ ] Document SKIP_DOCKER for CI only

---

## Links

- Worker scaffold: [worker/compute_manager/plan.md](../../worker/compute_manager/plan.md)
- Service doc: [docs/services/compute_manager.md](../services/compute_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

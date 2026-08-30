# network_manager — production plan

**Port:** 3103 · **AWS analog:** VPC · **Category:** Compute · **Tier:** production-ready

**Navigation:** [← schedule_manager](./schedule_manager.md) · [Index](./README.md) · [api_manager →](./api_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Per-project Docker bridge networks (Layer B). Cross-device VPC overlay = [vpc_network.md](./vpc_network.md).

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole |
| Tests | networksApi.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- SKIP_DOCKER metadata mode
- No firewall rules

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup network_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos network_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info network_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] requireAuth on all routes
- [ ] Auto-attach compute_manager tasks to project network
- [ ] Document network naming convention
- [ ] Headscale integration — ACL tags, preauth keys, overlay registry — [vpc_network.md](./vpc_network.md)
- [ ] Console **VPC** view: nodes, tags, connectivity matrix
- [ ] Security groups API (sync with Headscale ACL where applicable)

---

## Links

- Worker scaffold: [worker/network_manager/plan.md](../../worker/network_manager/plan.md)
- Service doc: [docs/services/network_manager.md](../services/network_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

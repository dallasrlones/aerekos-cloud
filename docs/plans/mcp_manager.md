# mcp_manager — production plan

**Port:** 3123 · **AWS analog:** Bedrock Agents tools · **Category:** Dev tools · **Tier:** stub

**Navigation:** [← app_manager](./app_manager.md) · [Index](./README.md) · [host_manager →](./host_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

MCP tool registry metadata.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No live MCP server processes

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup mcp_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos mcp_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info mcp_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Spawn MCP servers via compute_manager
- [ ] Tool invoke auth via ai_manager credentials

---

## Links

- Worker scaffold: [worker/mcp_manager/plan.md](../../worker/mcp_manager/plan.md)
- Service doc: [docs/services/mcp_manager.md](../services/mcp_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

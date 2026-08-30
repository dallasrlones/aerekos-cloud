# webhook_manager — production plan

**Port:** 3112 · **AWS analog:** EventBridge / SNS HTTP · **Category:** Integrations · **Tier:** production-ready

**Navigation:** [← queue_manager](./queue_manager.md) · [Index](./README.md) · [git_manager →](./git_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Outbound webhook endpoints + dispatch + delivery log.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole |
| Tests | webhooksApi + e2e Tier 3 |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- SKIP_OUTBOUND in tests
- No retry/DLQ policies

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:webhook:endpoint/{name}` |
| Scopes | webhook:Dispatch, webhook:Manage |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup webhook_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos webhook_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info webhook_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on endpoint create
- [ ] requireAuth + scope webhook:Dispatch
- [ ] Retry with backoff + dead letter log
- [ ] Inbound webhook receiver (future)

---

## Links

- Worker scaffold: [worker/webhook_manager/plan.md](../../worker/webhook_manager/plan.md)
- Service doc: [docs/services/webhook_manager.md](../services/webhook_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

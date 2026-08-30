# queue_manager — production plan

**Port:** 3101 · **AWS analog:** SQS · **Category:** Compute · **Tier:** production-ready

**Navigation:** [← compute_manager](./compute_manager.md) · [Index](./README.md) · [webhook_manager →](./webhook_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Message queues: send/receive/delete, visibility timeouts.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole |
| Tests | queues.api.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- SQLite only; no multi-worker fan-out
- No DLQ

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:queue:queue/{name}` |
| Scopes | queue:Send, queue:Receive, queue:Delete, queue:Admin |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup queue_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos queue_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info queue_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on queue create
- [ ] requireAuth + requireResource
- [ ] Document persistence limits
- [ ] Optional DLQ segment
- [ ] Bespoke console UI (post app-access)

---

## Links

- Worker scaffold: [worker/queue_manager/plan.md](../../worker/queue_manager/plan.md)
- Service doc: [docs/services/queue_manager.md](../services/queue_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

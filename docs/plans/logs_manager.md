# logs_manager — production plan

**Port:** 3104 · **AWS analog:** CloudWatch Logs · **Category:** Observability · **Tier:** production-ready

**Navigation:** [← registry_manager](./registry_manager.md) · [Index](./README.md) · [schedule_manager →](./schedule_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Append/query logs + batch ingest from worker outbox.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole |
| Tests | logsApi.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No retention/TTL
- No full-text search

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup logs_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos logs_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info logs_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Retention policy + compaction job
- [ ] requireAuth for ingest (service token or auth_manager)
- [ ] Log viewer in console
- [ ] Correlation ID propagation

---

## Links

- Worker scaffold: [worker/logs_manager/plan.md](../../worker/logs_manager/plan.md)
- Service doc: [docs/services/logs_manager.md](../services/logs_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

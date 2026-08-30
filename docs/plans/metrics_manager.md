# metrics_manager — production plan

**Port:** 3105 · **AWS analog:** CloudWatch Metrics · **Category:** Observability · **Tier:** stub

**Navigation:** [← api_manager](./api_manager.md) · [Index](./README.md) · [security_manager →](./security_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

SQLite metric sample CRUD. No scrape or aggregation.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No Prometheus remote write
- No alarms

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup metrics_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos metrics_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info metrics_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Prometheus scrape endpoint standardization
- [ ] Remote write or aggregation cluster
- [ ] Grafana dashboard templates
- [ ] Or: deprecate in favor of conductor /metrics only

---

## Links

- Worker scaffold: [worker/metrics_manager/plan.md](../../worker/metrics_manager/plan.md)
- Service doc: [docs/services/metrics_manager.md](../services/metrics_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

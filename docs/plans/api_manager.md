# api_manager — production plan

**Port:** 3124 · **AWS analog:** API Gateway · **Category:** Dev tools · **Tier:** stub → **P2** (with p9-api-manager / lock-4)

**Navigation:** [← network_manager](./network_manager.md) · [Index](./README.md) · [metrics_manager →](./metrics_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Gateway route definitions (metadata only). No runtime proxy.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No live reverse proxy
- Pretty invoke URLs not implemented

## App access

**Candidate:** No / internal / future.

Not app-facing.

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup api_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos api_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info api_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks (p9-api-manager, lock-4)

AWS API Gateway / GCP API Gateway pattern — pretty URLs hide raw manager paths.

- [ ] **p9-api-manager** Runtime gateway: map `public_path` → conductor proxy or ARN
- [ ] **lock-4** Route templates: `/v1/projects/{pid}/ai/…` → `arn:aerekos:{pid}:ai:llm:endpoint/{name}`
- [ ] **api-gw-1** Per-project route table CRUD (existing stub metadata → live routes)
- [ ] **api-gw-2** Conductor edge or api_manager process terminates TLS at tunnel origin
- [ ] **api-gw-3** Route health checks + 503 when backend manager down (E15)
- [ ] **api-gw-4** OpenAPI export per project — merged from catalog + custom routes
- [ ] **api-gw-5** Credential card shows pretty invoke URL (not raw proxy path)
- [ ] **api-gw-6** Rate limits per route + per credential (AWS usage plan analog)
- [ ] **api-gw-7** `aerekos api routes list|create` CLI + EdgeManager link
- [ ] **api-gw-8** Integration tests: route → ARN → scoped 403

---

## Links

- Worker scaffold: [worker/api_manager/plan.md](../../worker/api_manager/plan.md)
- Service doc: [docs/services/api_manager.md](../services/api_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

# secrets_manager — production plan

**Port:** 3107 · **AWS analog:** Secrets Manager · **Category:** Identity · **Tier:** production-ready

**Navigation:** [← key_manager](./key_manager.md) · [Index](./README.md) · [storage_manager →](./storage_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Encrypted secrets via key_manager envelope. reveal=1 returns plaintext.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ServiceSecretsList (KeyManager) |
| Tests | secretsApi.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No route-level auth on direct port
- MOCK_KEY_MANAGER=true default in compose
- reveal=1 very powerful

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:secrets:secret/{name}` |
| Scopes | secrets:GetValue, secrets:List, secrets:Put |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup secrets_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos secrets_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info secrets_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on secret create; include in list/get
- [ ] requireAuth + requireResource on all routes
- [ ] Scope secrets:GetValue for app credentials only
- [ ] Audit log on reveal=1
- [ ] MOCK_KEY_MANAGER=false in prod compose
- [ ] App access panel in console

---

## Links

- Worker scaffold: [worker/secrets_manager/plan.md](../../worker/secrets_manager/plan.md)
- Service doc: [docs/services/secrets_manager.md](../services/secrets_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

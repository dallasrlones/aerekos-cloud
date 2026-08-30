# auth_manager — production plan

**Port:** 3116 · **AWS analog:** Cognito · **Category:** Identity · **Tier:** real-partial

**Navigation:** [← conductor](./conductor.md) · [Index](./README.md) · [ai_manager →](./ai_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Token issuer (mint/verify), OIDC provider CRUD. Central auth for all managers.

## Current state

| Area | Status |
|------|--------|
| Implementation | real-partial |
| Console UI | AuthManager (bespoke) |
| Tests | P4 crud + health |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- No Credential model/CRUD yet (env-only AUTH_CLIENTS)
- Signing secret dev fallback if KMS unavailable
- OIDC login flow not end-to-end
- No rate limit on /auth/token

## App access

**Candidate:** Admin-only — conductor user JWT or service token. No app credentials.



## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup auth_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos auth_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info auth_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Credential model + /api/v1/credentials CRUD
- [ ] TokenService: dynamic clients from DB, typ=app claims
- [ ] Bootstrap signing secret from secrets_manager (prod)
- [ ] Rate limit /auth/token; audit credential lifecycle
- [ ] Console: Credentials tab (or shared component)
- [ ] Integration test: credential → token → verify claims

---

## Links

- Worker scaffold: [worker/auth_manager/plan.md](../../worker/auth_manager/plan.md)
- Service doc: [docs/services/auth_manager.md](../services/auth_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

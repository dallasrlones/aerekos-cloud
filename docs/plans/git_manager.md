# git_manager — production plan

**Port:** 3130 · **AWS analog:** CodeCommit · **Category:** Dev tools · **Tier:** production-ready

**Navigation:** [← webhook_manager](./webhook_manager.md) · [Index](./README.md) · [tunnel_manager →](./tunnel_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Bare repos, Smart HTTP transport, push events.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | ManagerConsole only |
| Tests | reposApi + e2e Tier 5 git transport |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- Smart HTTP on :3130 bypasses conductor JWT
- Separate GIT_AUTH_TOKEN not integrated with auth_manager
- No repo browser UI

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:git:repository/{name}` |
| Scopes | git:Read, git:Push, git:Admin |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup git_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos git_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info git_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on repo create
- [ ] Smart HTTP auth via auth_manager token (Basic/Bearer)
- [ ] Proxy git transport through conductor OR document credential flow
- [ ] Bespoke GitManager UI: repos, branches, pushes
- [ ] Scope git:Push vs git:Read on transport

---

## Links

- Worker scaffold: [worker/git_manager/plan.md](../../worker/git_manager/plan.md)
- Service doc: [docs/services/git_manager.md](../services/git_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

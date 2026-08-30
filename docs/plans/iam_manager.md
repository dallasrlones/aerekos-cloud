# iam_manager — production plan

**Port:** 3106 · **AWS analog:** IAM · **Category:** Identity · **Tier:** stub-data

**Navigation:** [← ai_manager](./ai_manager.md) · [Index](./README.md) · [key_manager →](./key_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Roles, policies (JSON), bindings. Enforcement should live in conductor.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub-data |
| Console UI | ManagerConsole |
| Tests | iamApi.test.js |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | Yes |

### Known gaps

- Policies stored but NOT evaluated at proxy or managers
- No ARN validation on policy resources

## App access

**Candidate:** Admin-only — conductor user JWT or service token. No app credentials.

Policies may reference: Policies reference arn:aerekos:{pid}:…

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup iam_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos iam_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info iam_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Policy schema validation for ARN resources
- [ ] conductor/api/services/PolicyEvaluator.js — evaluate on proxy
- [ ] Human JWT: check iam policies; App JWT: credential allowed_resources (MVP)
- [ ] Console: policy editor with ARN picker
- [ ] Tests: deny/allow matrix

---

## Links

- Worker scaffold: [worker/iam_manager/plan.md](../../worker/iam_manager/plan.md)
- Service doc: [docs/services/iam_manager.md](../services/iam_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

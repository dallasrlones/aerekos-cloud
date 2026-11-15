# key_manager — production plan

**Port:** 3102 · **AWS analog:** KMS · **Category:** Core · **Tier:** production-ready

**Navigation:** [← iam_manager](./iam_manager.md) · [Index](./README.md) · [secrets_manager →](./secrets_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Symmetric keys, envelope encryption, rotation. Backs storage + secrets.

## Current state

| Area | Status |
|------|--------|
| Implementation | production-ready |
| Console UI | KeyManager (bespoke) |
| Tests | 9 test files (strong) |
| Direct-port auth | Mostly none — see [platform_app_access.md](./platform_app_access.md) P1 |
| Project scoping | No (global) |

### Known gaps

- No project isolation (global keys)
- MASTER_KEY required in prod
- Direct port: service token only on mutations

## App access

**Candidate:** Admin-only — conductor user JWT or service token. No app credentials.



## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup key_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos key_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info key_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] Document prod MASTER_KEY rotation procedure
- [ ] Optional: project-scoped key aliases (future)
- [ ] Ensure MOCK_KEY_MANAGER=false everywhere in prod
- [ ] Health/metrics in dashboard

---

## Links

- Worker scaffold: [worker/key_manager/plan.md](../../worker/key_manager/plan.md)
- Service doc: [docs/services/key_manager.md](../services/key_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

# worker_manager — production plan

**Port:** 3128 · **AWS analog:** SSM fleet tags / Resource Groups · **Category:** Fleet · **Tier:** stub → **P2**

**Navigation:** [← host_manager](./host_manager.md) · [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [system_manager →](./system_manager.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Worker annotations and fleet metadata — must stay in sync with conductor `Worker` model (GCP fleet labels / AWS SSM tags).

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Sync | **Not wired** to conductor worker registry |

## App access

**Admin-only.**

---

## Fleet checklist (cc-fleet-*)

- [ ] **cc-fleet-2a** Sync annotations from conductor Worker on register/heartbeat
- [ ] **cc-fleet-2b** Tags: `role` (prod|worker|gpu), `env`, `project_ids`, `updater_version`
- [ ] **cc-fleet-2c** Expose in DeviceDetails alongside host_manager data
- [ ] **cc-fleet-4** Worker register flow includes Headscale preauth (cc-hs-3) in one response
- [ ] **cc-fleet-2d** `aerekos worker annotate --hostname orin --tags gpu=true`

---

## Setup wizard

- [ ] catalog `setup` metadata
- [ ] [service_setup_wizard.md](./service_setup_wizard.md) parity

## CLI & click ops parity

- [ ] `aerekos worker_manager …` list/create/get/update/delete
- [ ] Copy CLI on console mutations

---

## Links

- [worker.md](./worker.md) · [vpc_network.md](./vpc_network.md)
- Cursor: **cc-fleet-2**, **cc-fleet-4**

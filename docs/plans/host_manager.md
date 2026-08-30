# host_manager — production plan

**Port:** 3122 · **AWS analog:** EC2 inventory / Systems Manager inventory · **Category:** Fleet · **Tier:** stub → **P2**

**Navigation:** [← mcp_manager](./mcp_manager.md) · [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [worker_manager →](./worker_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Host inventory — must reflect **live fleet truth** from conductor worker heartbeats (AWS EC2 describe-instances / GCP Compute instances list). Today: manual stub rows.

## Current state

| Area | Status |
|------|--------|
| Implementation | stub |
| Console UI | ManagerConsole |
| Tests | P4 crud |
| Sync | **Not synced** from worker heartbeats |

## App access

**Admin-only** — no app credentials.

---

## Fleet truth checklist (cc-fleet-*)

- [ ] **cc-fleet-1a** Cron/sync job: conductor `Worker` rows → host_manager upsert by hostname
- [ ] **cc-fleet-1b** Fields: hostname, IP, CPU/RAM/disk, last_heartbeat, worker_id, projects[]
- [ ] **cc-fleet-1c** Mark stale when heartbeat > threshold (align cc-alerts-1)
- [ ] **cc-fleet-1d** Link host row → DeviceDetails screen (deep link)
- [ ] **cc-fleet-1e** Headscale node_id on host row when cc-hs-3 ships
- [ ] **cc-fleet-3** Fleet health row on Dashboard: online count, version drift

---

## Setup wizard

- [ ] `setup` metadata in catalog — depends on worker online
- [ ] Readiness: at least one host synced
- [ ] `aerekos setup host_manager --status` — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos host list --project $PID`
- [ ] `aerekos host get {hostname}`
- [ ] Console mirrors CLI; Copy CLI on mutations

---

## Links

- [worker.md](./worker.md) · [release_fleet.md](./release_fleet.md)
- Cursor: **cc-fleet-1**, **cc-fleet-3**

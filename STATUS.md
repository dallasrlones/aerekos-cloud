# aerekos-cloud — STATUS (OSS / GA)

**Updated:** 2026-11-15 · **Tag intent:** `v0.1.0` after [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md)  
**Canonical checklist:** [GA_CHECKLIST](docs/GA_CHECKLIST.md) · **Todo registry:** [docs/plans/MASTER_TODOS.md](docs/plans/MASTER_TODOS.md)  
**Full work queue:** [docs/plans/FULL_WORK_REGISTRY.md](docs/plans/FULL_WORK_REGISTRY.md) (58 managers + todo.md epics + cross-cuts)  
**Fleet-private inventory:** sibling [`../aerekos-cloud-STATUS.md`](../aerekos-cloud-STATUS.md) (not mirrored).

## Icarus self-modify (2026-11-13)

Slices 0–3 (fleet apply → chat → disk self-edit → UI approve) **DoD hit on fleet**. Follow-ups live in fleet STATUS: auth_manager `JWT_SECRET` parity (inventory 401s), commit `isLiveness` + key_manager port `3102`, optional merge `icarus/self-slice3`.

## Wave closeouts (this pass)

| Wave | Status | Notes |
|------|--------|-------|
| W0–W2 | Mostly green | Live Part I + wants on non-prod; pack-mirror / scrub; ServiceGuide foundation |
| W3–W4 | In progress | AUTH_REQUIRED proof, stack single-writer, git vs IDE; **prod JWT parity still flaky** |
| W5 | In progress | **aerekos Compute** = own K8s-class orchestrator (not ECS-lite) |
| W6–W7 | Appliance path | Limits + restore drill documented |
| W8–W19 | Closing | OpenAPI, manager e2e, Icarus gates, OSS/security, UX, tenancy/chaos |

## Keepers (private fleet only)

`aerekos-tv`, `aerekos-music`, `aerekos-drive`, `forged-lumen` — never delete; denylisted from [`scripts/oss/pack-mirror.sh`](scripts/oss/pack-mirror.sh).

## Live smoke (non-prod)

Set `e2e.local.env` (gitignored): `CONDUCTOR_URL`, `PROJECT_ID`, `AEREKOS_C0_ADMIN_TOKEN`.

```bash
node e2e/icarus-platform-matrix.js
node e2e/icarus-laya-flows.js
node e2e/icarus-wants-matrix.js
```

## Compute product

**aerekos Compute** is our Kubernetes-class control plane: declarative Deployments, controllers, rolling updates with abort/rollback. Docker is the v0.1.0 **node agent** only. See `docs/adr/004-aerekos-compute-orchestrator.md`.


## Wave status (2026-11-15)

- All **58** manager closeouts `done` on `main`
- **Wave 9** in progress: ops-conductor + cross-cuts (x-sdk…x-cross-platform)
- `ops-gate0` still parked (fleet SSH/LAN)

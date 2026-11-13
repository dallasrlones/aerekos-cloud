# aerekos-cloud — STATUS (OSS / GA)

**Updated:** 2026-11-13 · **Tag intent:** `v0.1.0` after [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md)  
**Canonical checklist:** [GA_CHECKLIST](docs/GA_CHECKLIST.md) · **Todo registry:** [docs/plans/MASTER_TODOS.md](docs/plans/MASTER_TODOS.md)  
**Fleet-private inventory:** sibling `../aerekos-cloud-STATUS.md` (not mirrored).

## Wave closeouts (this pass)

| Wave | Status | Notes |
|------|--------|-------|
| W0–W2 | Mostly green | Live Part I + wants on non-prod; pack-mirror / scrub; ServiceGuide foundation |
| W3–W4 | In progress | AUTH_REQUIRED proof, stack single-writer, git vs IDE |
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

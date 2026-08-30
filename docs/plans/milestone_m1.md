# Milestone 1 — “Apps call AI + storage securely”

> **Goal:** First shippable production slice — AWS/GCP-style app credentials on AI (reference) + storage auth, with operable console and deploy gates.  
> **Navigation:** [MASTER_TODOS.md](./MASTER_TODOS.md) · [Index](./README.md)

---

## Finish line

M1 is done when:

1. App creates credential in auth_manager → gets scoped token → invokes AI endpoint and storage bucket via `cloudapi` without conductor token swap.
2. `AUTH_REQUIRED=true` on prod managers; secrets rotated; catalog honest about stubs.
3. Header search + setup wizard Phase 1–2 work; deploy runbook exists; PR gate green.
4. CF token in secrets_manager (ops); storage `pro-storage-1` complete.

---

## In M1

| Area | Todo IDs |
|------|----------|
| **Platform** | p0-primitives, p1-credentials, p2-conductor, p3-endpoints, p4-enforcement, p5-ui |
| **Hardening (partial)** | p10-hardening (AUTH_REQUIRED, rotate secrets, enablement UX), lock-1, lock-2, lock-5, lock-9 |
| **Storage** | pro-storage-1 only (auth + ARN + scopes — not full S3 parity) |
| **DX** | p8-dx partial, e4, e19, e30, e31 |
| **Console** | cc-search-1, cc-search-2, cc-wizard-1, cc-wizard-2 |
| **Onboarding** | cc-project-2, cc-project-3 |
| **Ops** | ops-pre-1 through ops-pre-4, e10 skeleton, pro-edge-0 (secrets only) |
| **Runbooks** | [release_fleet.md](./release_fleet.md) verify sidecar exists (no full automation) |

---

## After M1 (do not block M1)

| Area | Todo IDs |
|------|----------|
| Full app rollout | p6-rollout, p7-iam, p9-api-manager, lock-4 |
| Storage S3 parity | pro-storage-2, pro-storage-3 |
| Edge automation | pro-edge-1 through pro-edge-7 |
| VPC / Headscale | cc-vpc-*, cc-hs-*, lock-11 |
| Enterprise bulk | E1–E3, E5–E9, E11–E18, E20–E45 |
| Fleet | cc-fleet-*, release-fleet-* |
| Alerts | cc-alerts-* |
| Post-MVP | post-e46–e54 |
| Deferred | defer-3p |

---

## Build order (M1 only)

```
ops-pre-1, ops-pre-4 (rotate secrets, catalog tiers)
  → p0-primitives
  → p1-credentials
  → p2-conductor
  → p3-endpoints → p4-enforcement → p5-ui
  → pro-storage-1 (parallel)
  → lock-2, lock-5, p10-hardening
  → cc-wizard-1, cc-wizard-2, cc-search-1, cc-search-2
  → e19 PR gate + e10 runbook skeleton
  → ops-pre-2 (CF secrets)
  → M1 sign-off: e2e Tier 6 smoke
```

---

## Links

- [platform_app_access.md](./platform_app_access.md)
- [MASTER_TODOS.md](./MASTER_TODOS.md)

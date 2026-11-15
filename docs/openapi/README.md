# OpenAPI pack (`docs/openapi/`)

Per-manager contracts for every `worker/*_manager` and `worker/code_as_infra`, plus a catalog-generated CORE_GA proxy pack.

## Layout

| Artifact | Role |
|----------|------|
| `<name>.yaml` | Canonical pack entry for manager `name` (usually mirrors `worker/<name>/api/openapi.yaml`) |
| `ga-managers.generated.yaml` | Conductor-proxy paths for **CORE_GA** managers only — do not edit by hand |
| `PARKED_GAPS.md` | Explicit exceptions to the per-manager file rule |
| `ai_manager_memory.yaml` | Fragment (see parked gaps) |
| `conductor_*.yaml` | Conductor surfaces (not worker managers) |

**CORE_GA** (generated pack): `key_manager`, `storage_manager`, `secrets_manager`, `compute_manager`, `queue_manager`, `iam_manager` (+ conductor).

## Regenerate CORE_GA pack

```bash
node scripts/oss/gen-openapi-from-catalog.mjs
```

Source of truth: `docs/catalog.js`. After catalog endpoint changes for a CORE_GA manager, regenerate and commit `ga-managers.generated.yaml`.

## Verify pack currency

```bash
node scripts/oss/check-openapi-pack.mjs
# optional: also fail if generated file is stale
node scripts/oss/check-openapi-pack.mjs --check-generated
```

The check ensures:

1. Every worker `*_manager` / `code_as_infra` has `docs/openapi/<name>.yaml` **or** is listed in `PARKED_GAPS.md`
2. (with `--check-generated`) `ga-managers.generated.yaml` matches a fresh regen from the catalog

## Sync worker ↔ docs

When a manager owns `worker/<name>/api/openapi.yaml`, keep `docs/openapi/<name>.yaml` in sync (copy on closeout). Prefer the worker file as the editing surface; the docs copy is the pack inventory entry.

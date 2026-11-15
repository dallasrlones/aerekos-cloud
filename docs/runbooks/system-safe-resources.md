# System-safe resources (undeletable / protected)

Wave 9 slice for `x-user-system-safe`: what already refuses user/API delete of platform-critical resources, what this wave hardened, and honest remaining gaps.

## Existing guards (pre-wave)

| Resource | Guard | Behavior | Tests |
|----------|-------|----------|-------|
| **System project** (`id` `9d8bde11-…` or name `system`) | `conductor/api/config/systemProject.js` + `ProjectService.deleteProject` / `ProjectRepository.delete` / UI `ProjectContext` | `403` + `SYSTEM_PROJECT_IMMUTABLE` | `conductor/tests/unit/systemProjectDelete.test.js` |
| **System project environments** | `EnvironmentService` treats system project as special (prod-only env create rules) | Restricts non-`prod` env creation on system project | `environmentService.test.js` (partial) |
| **System buckets (existence)** | Separate `/api/systems/:systemId/buckets…` API; `project_id` null | Not listed under project bucket APIs | `SystemBuckets.test.js` |

## Hardened this wave

| Resource | Guard | Behavior |
|----------|-------|----------|
| **Protected system buckets** | `worker/storage_manager/api/utils/systemResourceGuard.js` → `BucketService.deleteSystemBucket` | `403` + `SYSTEM_BUCKET_IMMUTABLE` when `metadata.protected` / `immutable` / `undeletable` is truthy **or** bucket name is in `SYSTEM_PROTECTED_BUCKET_NAMES` (comma-separated) |

Mark a bucket at create/update time:

```json
{ "name": "tv-media", "metadata": { "protected": true }, "base_path": "/mnt/…" }
```

Or set env on storage_manager (compose/fleet):

```bash
SYSTEM_PROTECTED_BUCKET_NAMES=tv-media,tv-posters
```

## Remaining gaps (honest)

1. **db_manager** — no `system` / `protected` / `immutable` delete guard; any project DB (including ones used as platform state) can be deleted via API if the caller has project access.
2. **System bucket files** — object DELETE under a protected bucket is still allowed; only **bucket** delete is refused.
3. **Unprotect via PATCH** — `updateSystemBucket` can rewrite metadata and clear `protected` unless operators also lock names via `SYSTEM_PROTECTED_BUCKET_NAMES`.
4. **Secrets / keys / configs** — no cross-manager “system resource” registry; key_manager keys created for system buckets are not marked undeletable.
5. **UI** — conductor project delete is gated; there is no dedicated “system buckets” admin UI that surfaces the immutable flag.
6. **Default unmarked** — existing system buckets without metadata/env are still deletable (by design until marked).
7. **Force override** — no break-glass `?force=1` / admin role path yet; operators must clear the mark or env to delete.

## Next slices (not this wave)

- db_manager: refuse delete when DB metadata marks `system`/`protected`, or when `project_id` is the system project.
- Refuse object delete inside protected system buckets (or soft-delete only).
- Refuse clearing `metadata.protected` without an elevated token.
- Seed platform buckets (`tv-media`, `tv-posters`, …) with `protected: true` at create time.

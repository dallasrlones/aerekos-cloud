# Worker scripts

## `scaffold-manager-services.mjs`

Code generator: reads `manager-services-manifest.json` and creates or overwrites **template** files for each listed service under `worker/<name>/` (Express shell, Jest, Docker, `plan.md` / `README` stubs). **Unimplemented** services report `status: "stub"` on `GET /api/v1/info` until you add product routes; this script does **not** mean those folders are “fake”—they are a consistent starting point.

**When to use**

- After adding a row to the manifest for a new `-manager` service
- To re-apply templates if you intentionally change the generator (review diffs — this overwrites generated files)

**Does not overwrite:** `key_manager`, `storage_manager`, `db_manager` (not in manifest).

```bash
# from repo root
node worker/scripts/scaffold-manager-services.mjs
```

**P4 SQLite CRUD batch** (re-applies the generic per-service layout; review diffs before committing):

```bash
node worker/scripts/generate-p4-sqlite-mvp.mjs
```

See [`MANAGER_SERVICES.md`](../MANAGER_SERVICES.md) for the service matrix and ports.

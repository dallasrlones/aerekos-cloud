# ADR 003 — git_manager is origin

Status: accepted

Humans and agents push to Smart HTTP on git_manager (`https://git.aerekos.com/<repo>.git`, remote name `aerekos-git`). Flow is: push a branch → cicd_manager matches pipelines for that `repo_name` → optional test → deploy **only** if the ref matches that pipeline’s environment `git_ref`.

FF merge is `git update-ref` and does **not** fire `post-receive`. Merge must call `RepoService.recordPush` (with `from_merge`) so Actions run.

## App deploy is per-env branch

An environment’s `git_ref` is the source of truth for which branch deploys that env (prod defaults to `main`; other envs default to the env name / `develop`). Each pipeline is one `(repo, dockerfile, env)` row: it inherits `environment` + `git_ref`, and may set `require_pr`, `hostname` / `port`, `target_container_id`, and `pin_worker_id`.

- `require_pr=false` (default): a push to `git_ref` tests (if configured) then deploys the linked Cloud task.
- `require_pr=true`: deploy only when the push is a merge into `git_ref`.
- Other branches never deploy that pipeline.
- **Unlinked pipelines never `POST /tasks`.** Deploy errors `TARGET_REQUIRED` until a Cloud task is linked. Tests still run.

Task runtime env = non-secret task env + `secrets_manager` values for that `project_id` + environment. The console hides secret-like keys.

Fleet placement: empty pin stays on this host (prod-mini). A remote pin (`pin_worker_id`) creates, logs, health, and replace-image on that worker. CI builds may push to `INTERNAL_REGISTRY` so the pinned worker can pull. Do not Cloudflare-expose `:5050`.

New envs later: `POST /environments` + duplicate (copies tasks with pin and secret **values**) + attach hostnames + link pipelines. Do not invent hostnames on duplicate.

## Fleet release stays main-only

**aerekos-cloud on the system project + `main`:** cicd publishes a release tarball on conductor (`POST /api/releases`) and nudges every registered updater. It does not SSH, rsync, or call `compute_manager` `deploy()` / `apply-stack` on the conductor image. Devices apply the same artifact with their own `ROLE` (`core`/`conductor` mixed-stack safe; `worker` + optional ai compose). Sandbox / non-system `aerekos-cloud` stays a no-op (record test).

Do not `git pull` on devices. Do not wire `.github/workflows/deploy.yml` or `deploy.sh full` as the auto path.

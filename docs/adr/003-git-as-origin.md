# ADR 003 — git_manager is origin

Status: accepted

Humans and agents push to Smart HTTP on git_manager (`https://git.aerekos.com/<repo>.git`, remote name `aerekos-git`). `main` stays protected. Flow is: push a branch → open a PR in the console → fast-forward merge → cicd_manager loads `.aerekos/workflows/deploy.yml` from the merged SHA.

FF merge is `git update-ref` and does **not** fire `post-receive`. Merge must call `RepoService.recordPush` so Actions run.

App repos: `test` then `deploy` updates that environment’s compute task only.

**aerekos-cloud on the system project + `main`:** cicd publishes a release tarball on conductor (`POST /api/releases`) and nudges every registered updater. It does not SSH, rsync, or call `compute_manager` `deploy()` / `apply-stack` on the conductor image. Devices apply the same artifact with their own `ROLE` (`core`/`conductor` mixed-stack safe; `worker` + optional ai compose). Sandbox / non-system `aerekos-cloud` stays a no-op (record test).

Do not `git pull` on devices. Do not wire `.github/workflows/deploy.yml` or `deploy.sh full` as the auto path.

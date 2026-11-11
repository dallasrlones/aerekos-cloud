# Adonis IDE + GitHub-like git_manager

**Status:** implemented 2026-11-11  
**Goal:** Feel like **local GitHub + Cloud9** — browse/edit/branch/PR in git hosting, full IDE with terminal and **Deploy** into compute.

## Product split (locked)

| Piece | Responsibility |
|-------|----------------|
| **git_manager** | Hosting: Smart HTTP, repos, branches, commits, tree/blob, PRs, issues, webhooks → cicd |
| **Adonis** | IDE UX: editor, terminal, branch ops, Run/Deploy — talks to git_manager + compute_manager |
| **compute_manager** | Runs workspace/dev containers and app deploy tasks |

Do **not** embed a full IDE inside the git_manager Node process.

## Shipped

### A — git_manager API + console UX

- [x] `POST /repos/:id/branches`, `commit-file` respects `branch` + optional `base_sha` (409 on mismatch)
- [x] `POST /repos/:id/delete-file`, `GET /repos/:id/compare`
- [x] Repo create seeds `README.md`
- [x] GitManager: list → repo home, branch switcher, edit/save, add/delete file, Open in Adonis, clone under settings, PR checks strip
- [x] Jest real-git: `worker/git_manager/tests/integration/branchCommit.test.js`

### B — Adonis IDE

- [x] Screen + `/adonis` route, service catalog, Header
- [x] Monaco (web) / TextInput fallback; dirty guard; commit with `base_sha`
- [x] Conductor BFF: `POST/DELETE /api/adonis/workspaces`, `POST /api/adonis/deploy` (caller JWT for clone; never fleet `GIT_AUTH_TOKEN`)
- [x] Terminal via container exec; Stop workspace; Deploy requires Dockerfile

### C — E2E

- [x] `e2e/wave-adonis-git.js` (wired in `e2e/run-waves.js`)
- Run: `CONDUCTOR_URL=… node e2e/wave-adonis-git.js`

## Auth model (workspaces)

Ensure-workspace injects the **caller JWT** as `ADONIS_GIT_TOKEN` into the compute task. Smart HTTP accepts that JWT as Basic password (same as CLI clone). Fleet shared `GIT_AUTH_TOKEN` is never placed in user workspaces.

## Non-goals (still)

- Full Actions marketplace, Gists, Packages UI, multiplayer editing, code-server, Playwright, interactive TTY WebSocket.

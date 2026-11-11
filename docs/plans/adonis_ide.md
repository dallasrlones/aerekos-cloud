# Adonis IDE + GitHub-like git_manager

**Status:** kicked off 2026-11-11 (after CI/CD fleet proof `c5432ce`)  
**Goal:** Feel like **local GitHub + Cloud9** — browse/edit/branch/PR in git hosting, full IDE with terminal and **Deploy** into compute.

## Product split (locked)

| Piece | Responsibility |
|-------|----------------|
| **git_manager** | Hosting: Smart HTTP, repos, branches, commits, tree/blob, PRs, issues, webhooks → cicd |
| **Adonis** | IDE UX: editor, terminal, branch ops, Run/Deploy — talks to git_manager + compute_manager |
| **compute_manager** | Runs workspace/dev containers and app deploy tasks |

Do **not** embed a full IDE inside the git_manager Node process.

## What exists today (audit)

**API (worker/git_manager):** routes for `repos`, `pulls`, `issues`, `checks`, Smart HTTP (`gitHttp.js`). Tree/blob/commits/branches already used by UI.

**Console (conductor/app/screens/GitManager):** repo list, tree browse, blob view, create repo, PRs (create/merge/comment/review), branches fetch. Looks thin vs GitHub — weak chrome, limited edit-in-browser, no IDE, no first-class “Deploy”.

**Deploy path:** cicd_manager pipelines + fleet release for system `aerekos-cloud`; app pipelines deploy linked compute tasks (ADR 003).

## MVP (implement next)

### A — git_manager “local GitHub” UX

1. Repo home closer to GitHub: README render, branch switcher, clone URL + token hint, default branch.
2. File edit + commit on a branch (API commit if missing; UI save → commit).
3. Create branch from UI; protect `main` optionally later.
4. PR polish: diff view, checks status from `checks.js`.
5. Visual design pass (not “ass”) while staying inside conductor app patterns.

### B — Adonis IDE (new surface)

1. Open repo@ref in Adonis workspace screen (or routed `/adonis/:project/:repo`).
2. Editor (Monaco or CodeMirror) backed by git_manager blob/commit APIs.
3. Integrated terminal → compute oneshot or persistent workspace container (`compute_manager`).
4. **Deploy** button → ensure cicd pipeline linked for repo/env → run deploy (or `compute_manager` task replace).
5. Branch create/switch from IDE chrome (calls git_manager).

### C — Wiring

- Auth: same conductor JWT / project scope.
- Secrets for git HTTP via existing `GIT_AUTH_TOKEN` / per-user tokens later.
- Device pin: workspace containers prefer online worker with free disk (same as IaC auto).

## Non-goals (MVP)

- Full Actions marketplace, Gists, Packages UI.
- Multiplayer collab editing.
- Replacing VS Code desktop.

## Implementation order

1. Gap list: which git_manager write APIs missing for commit-from-UI / create-branch.
2. GitManager UI redesign pass (A).
3. Scaffold Adonis screen + Monaco + open blob (B1–B2).
4. Terminal via compute (B3).
5. Deploy button → cicd/compute (B4).

## Success criteria

- Create branch, edit file, commit, open PR, merge — all from console without raw git CLI.
- Open Adonis on a repo, edit, deploy a containerized app to a worker via one Deploy action.
- git_manager remains usable as clone remote (`git.aerekos.com`) for CLI users.

# PR / review UX (Wave 10 · `x-pr-review-ux`)

**Owner:** `git_manager` pull/review APIs + Conductor `GitManager` console  
**Related:** [git_manager.md](./git_manager.md) · [git-vs-ide.md](../runbooks/git-vs-ide.md) · [pr-review-ux runbook](../runbooks/pr-review-ux.md)  
**Shared helper:** [`worker/git_manager/api/utils/reviewRequired.js`](../../worker/git_manager/api/utils/reviewRequired.js)  
**Audited:** 2026-11-15 · static inventory (no live stack)

---

## Verdict

PR create / comment / review / merge already exist on **`git_manager`** and a **Conductor GitManager** screen covers the happy path. Gaps: OpenAPI omits review/merge subroutes, console merge UX ignores `require_approval` / `changes_requested` until the API 409s, and repo settings have no UI to flip `require_approval`. This wave ships the inventory + a shared **review-required** flag helper (unit-tested) wired into the merge gate.

---

## API surfaces (`worker/git_manager`)

| Method | Path | Behavior |
|--------|------|----------|
| `POST` | `/api/v1/pulls` | Create PR (`title`, `source_branch`, `target_branch`, `repo_id`, `project_id`) |
| `GET` | `/api/v1/pulls` | List (`project_id`, optional `repo_id`) |
| `GET` | `/api/v1/pulls/:id` | Detail + `diff`, `comments`, `reviews`, `checks` |
| `POST` | `/api/v1/pulls/:id/comments` | Line/path optional comment |
| `POST` | `/api/v1/pulls/:id/reviews` | `state`: `approved` \| `changes_requested` \| `commented` |
| `POST` | `/api/v1/pulls/:id/merge` | Fast-forward merge; gates below |
| `POST` | `/api/v1/pulls/:id/notes` | Append operator notes |
| `GET`/`POST` | `/api/v1/checks` | Check runs (merge fails if any latest status is `failed`) |

**Models:** `PullRequest`, `PullComment`, `PullReview`, `CheckRun`; repo flag `Repository.require_approval` (0/1).

**Merge gates** (`pulls.js` + `reviewMergeGate`):

1. Reject if any review is `changes_requested`
2. If `reviewRequired(repo)` → require at least one `approved` review
3. Reject if any latest check run is `failed`
4. Observational enqueue to `queue_manager` `git-merge` (best-effort)

**OpenAPI:** `worker/git_manager/api/openapi.yaml` documents list/create pulls only — **stub gap:** `/:id`, comments, reviews, merge, notes not listed.

**Branch protection:** pre-receive hook denies direct push to protected refs unless `AEREKOS_ALLOW_DIRECT` (see `GitService.installPreReceiveHook`).

---

## Conductor UI (`conductor/app/screens/GitManager`)

| Surface | Status |
|---------|--------|
| Route / catalog | `gitManager` · service catalog “Source Repositories” |
| Repo tabs | Code · Commits · **Pull requests** · Issues · Clone & settings |
| PR list / create | Yes — title, source, target |
| PR detail | Diff via `parseUnifiedDiff` + `GitCodeView`; checks list |
| Approve / request changes / comment | Yes — posts to reviews/comments APIs |
| Merge button | Yes — client blocks only on **failed checks**; does **not** pre-check approvals / changes_requested (API returns 409) |
| `require_approval` toggle | **Missing** — no settings control; flag only via DB/API if set |
| AI agent PRs | Separate path: `ai_manager` `PrReviewService` (in-memory agent PRs / higher-model review) — not the same as `git_manager` pulls |

Icarus nav heuristic routes “git / repos / pull requests” phrases to GitManager (`icarusNavCatalog.js`).

---

## Stub / next UX notes

- Document and implement OpenAPI for review/merge subroutes.
- Console: disable Merge when `reviewMergeGate` would fail; show `require_approval` badge.
- Repo settings: PATCH `require_approval` from Clone & settings.
- Optional: surface `ai_manager` agent PR reviews alongside git_manager PRs (or link only).

---

## This wave shipped

- Plan inventory (this file)
- Runbook: [docs/runbooks/pr-review-ux.md](../runbooks/pr-review-ux.md)
- Helper + unit tests: `reviewRequired` / `reviewMergeGate`; merge route uses the helper

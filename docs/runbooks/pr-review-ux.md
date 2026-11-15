# PR review UX (operator notes)

Wave 10 slice for `x-pr-review-ux`. Full inventory: [docs/plans/pr-review-ux.md](../plans/pr-review-ux.md).

## Where to click

1. Conductor → **Source Repositories** (`GitManager`)
2. Open a repo → **Pull requests** tab → create or open a PR
3. Approve / Request changes / Comment → **Merge** (server enforces review + checks)

Proxy base: `/api/services/git_manager/api/v1/…` (needs `git_manager` enabled on the project).

## Review-required flag

Repos store `require_approval` (0/1). When set, merge requires an `approved` review and refuses `changes_requested`. Shared rule: `worker/git_manager/api/utils/reviewRequired.js`.

**Stub:** no console toggle yet — set via DB / future PATCH. UI merge button only pre-blocks on failed checks; approval/changes gates show as API 409 until UX catches up.

## Related

- Hosting vs IDE: [git-vs-ide.md](git-vs-ide.md)
- Agent (AI) PR review path lives in `ai_manager` `PrReviewService`, not this console tab

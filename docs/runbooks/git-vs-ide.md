# git_manager vs Icarus IDE (Adonis)

**W4 scope split** — keep hosting and workspace editing separate so stack/git/IaC writers do not fork.

| Surface | Role | Primary APIs |
|---------|------|----------------|
| **git_manager** | **Hosting** — Smart HTTP, repos, branches, commits, tree/blob, PRs, issues, webhooks → cicd | Conductor proxy `/api/services/git_manager/…` |
| **Icarus IDE** (Adonis) | **IDE workspace** — editor, terminal, branch ops, Run/Deploy; reads/writes via git_manager + compute | `/icarus/ide`, `ai_manager` project-services map |

Do **not** embed a full IDE inside the `git_manager` Node process. Icarus agents and Laya flows use the **project-services** graph and stack revision APIs on the conductor, not ad-hoc `code_as_infra` module CRUD.

**Further reading:** [adonis_ide.md](../plans/adonis_ide.md) (product split, shipped routes), [auth-required.md](auth-required.md) (direct `:31xx` ports), [mixed-stack.md](mixed-stack.md) (fleet compose).

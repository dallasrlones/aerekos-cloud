# Git + IaC for all projects (Wave 10)

## Current shape
- `worker/git_manager` — per-project repos, PRs, Smart HTTP
- `worker/code_as_infra` — IaC apply/plan surfaces
- Project create on conductor does **not** yet auto-provision a default git repo + IaC stub for every project

## This slice
- Document honesty + `scripts/ops/ensure-project-git-iac.md` checklist
- Next: conductor create-project hook calling git_manager ensure-default + code_as_infra seed

## Parked
Live fleet proof that every existing project has a repo (`ops-gate0`).

# Ensure project git + IaC (operator checklist)

For project `$PROJECT_ID` on a non-prod conductor:

1. `POST /api/services/git_manager/...` create default repo if missing
2. Seed `code_as_infra` stub (empty stack or hello) via manager API
3. Record project metadata linking repo id

Automation hook is a later slice — this checklist is the Wave 10 ship.

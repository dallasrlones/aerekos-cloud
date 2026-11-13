# Icarus IDE (formerly Adonis)

**Routes:** `/icarus/ide` (legacy `/adonis` still resolves)  
**Product:** Live coding with the Icarus agent — Monaco editor, terminal, deploy, **live services map**, agent file sync (`ai:ide.file`), Follow Icarus, PR dock hooks.

## Split

| Piece | Role |
|-------|------|
| git_manager | Hosting |
| Icarus IDE | Editor UX + services map + agent presence |
| compute_manager | Workspaces / deploy |

## Live events

- `ai:ide.file` — agent edit/patch
- `ai:ide.presence` — ghost cursor
- `ai:stack.update` / `ai:stack.highlight` — project services map

## API

- `GET .../ai_manager/api/v1/icarus/project-services?project_id=`
- Conductor BFF: `/api/adonis/workspaces`, `/api/adonis/deploy` (names kept for compat)

See also platform plan: talk → configure → live Flows.

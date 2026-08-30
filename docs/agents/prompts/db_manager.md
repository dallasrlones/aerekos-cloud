# Agent prompt — db_manager

Managed database control plane: provision/start/stop/restart database containers, backups + restore, health and volumes.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/db_manager{path}`

## Endpoints

- `POST /api/databases` — Provision a database
- `GET /api/databases` — List databases
- `GET /api/databases/:name` — Get a database
- `GET /api/databases/:name/connection` — Connection info
- `POST /api/databases/:name/start` — Start
- `POST /api/databases/:name/stop` — Stop
- `POST /api/databases/:name/restart` — Restart
- `POST /api/databases/:name/backups` — Create a backup
- `POST /api/databases/:name/backups/:backupId/restore` — Restore a backup
- `GET /api/databases/:name/health` — Health
- `DELETE /api/databases/:name` — Delete

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

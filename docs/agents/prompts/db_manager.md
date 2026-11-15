# Agent prompt — db_manager

Managed database control plane: provision/start/stop/restart engines (postgresql, mongodb, neo4j, elasticsearch, redis, sqlite3, lancedb), backups + restore, volumes, LanceDB vectors, constrained memory SQL.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/db_manager{path}`

## Endpoints

- `GET /api/info` — Service metadata
- `GET /health` — Liveness
- `GET /ready` — Readiness (key_manager unless MOCK_KEY_MANAGER)
- `POST /api/databases` — Provision a database (project_id query only; type required)
- `GET /api/databases` — List databases
- `GET /api/databases/:name` — Get a database (includes arn)
- `GET /api/databases/:name/connection` — Connection info
- `POST /api/databases/:name/start` — Start
- `POST /api/databases/:name/stop` — Stop
- `POST /api/databases/:name/restart` — Restart
- `POST /api/databases/:name/backups` — Create a backup
- `POST /api/databases/:name/backups/:backupId/restore` — Restore a backup
- `GET /api/databases/:name/health` — Health
- `GET /api/databases/:name/volumes` — Volume / mount metadata
- `POST /api/databases/:name/vectors/upsert` — Upsert vectors (lancedb)
- `POST /api/databases/:name/vectors/search` — Search vectors (lancedb)
- `DELETE /api/databases/:name/vectors` — Delete vectors (lancedb)
- `POST /api/databases/:name/memory/sql` — Constrained memory SQL (sqlite3)
- `DELETE /api/databases/:name` — Delete

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

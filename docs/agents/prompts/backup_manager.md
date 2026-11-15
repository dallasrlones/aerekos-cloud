# Agent prompt — backup_manager

Backup vaults and snapshot jobs into the aerekos-backups bucket. Restore db/storage/git/generic JSON via adapters. Multi-region AWS Backup parity is out of scope for MVP. No production skip-fakes (`assertNoSkipFakes` via `createManagerApp`). **Tutorial / ServiceGuide:** none.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/backup_manager{path}`

**Port:** `3134` · **OpenAPI:** `worker/backup_manager/api/openapi.yaml` (pack: `docs/openapi/backup_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default vault
- `POST /api/v1/vaults` — Create a vault ({ project_id, name, ... })
- `GET /api/v1/vaults` — List vaults (?project_id=)
- `GET /api/v1/vaults/:id` — Get one vault
- `PATCH`/`PUT /api/v1/vaults/:id` — Update a vault
- `DELETE /api/v1/vaults/:id` — Delete a vault
- `POST /api/v1/jobs` — Run a backup job { project_id, source, resource, vault }
- `GET /api/v1/jobs` — List backup jobs
- `GET /api/v1/jobs/:id` — Job metadata + signed download URL
- `POST /api/v1/jobs/:id/restore` — Restore a snapshot

SDK: `client.resource('backup_manager', 'vaults')`. CLI: `aerekos backup_manager vaults …` or `aerekos call` for jobs.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

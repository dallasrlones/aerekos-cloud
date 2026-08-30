# Agent prompt — backup_manager

Backup vaults and snapshot jobs into the aerekos-backups bucket. Restore db/storage/git/generic JSON.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/backup_manager{path}`

## Endpoints

- `POST /api/v1/vaults` — Create a vault ({ project_id, name, ... })
- `GET /api/v1/vaults` — List vaults (?project_id=)
- `GET /api/v1/vaults/:id` — Get one vault
- `PATCH /api/v1/vaults/:id` — Update a vault
- `DELETE /api/v1/vaults/:id` — Delete a vault
- `POST /api/v1/jobs` — Run a backup job { project_id, source, resource, vault }
- `GET /api/v1/jobs` — List backup jobs
- `GET /api/v1/jobs/:id` — Job metadata + signed download URL
- `POST /api/v1/jobs/:id/restore` — Restore a snapshot

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

# Agent prompt — security_manager

Security finding records (`severity`/`source`/`details`) plus metadata-only `POST /api/v1/findings/scan`. Detectors / SIEM wired later. No production skip-fakes (`assertNoSkipFakes` on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/security_manager{path}`

**Port:** `3108` · **OpenAPI:** `worker/security_manager/api/openapi.yaml` (pack: `docs/openapi/security_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/findings` — Create a finding ({ project_id, name, ... })
- `GET /api/v1/findings` — List findings (?project_id=)
- `GET /api/v1/findings/:id` — Get one finding
- `PATCH`/`PUT /api/v1/findings/:id` — Update a finding
- `POST /api/v1/findings/scan` — Metadata-only scan note (no live scanner)
- `DELETE /api/v1/findings/:id` — Delete a finding

SDK: `client.resource('security_manager', 'findings')`. CLI: `aerekos security_manager findings …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
Live conductor/proxy e2e parked until stack is up; scanners/SIEM out of scope for MVP.

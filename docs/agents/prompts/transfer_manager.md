# Agent prompt — transfer_manager

SFTP-style endpoint metadata (name/bucket/protocol). `ensure-defaults` seeds `sftp`. `POST /api/v1/endpoints/:id/put` and `…/get` copy objects through `storage_manager` via the conductor proxy (need `CONDUCTOR_URL`). No production skip-fakes (`assertNoSkipFakes` via index + `createManagerApp`). **Tutorial:** none standalone; generic ManagerConsole. **Not** a live SFTP daemon — Transfer Family naming analog only. Live conductor e2e parked.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/transfer_manager{path}`

**Port:** `3148` · **OpenAPI:** `worker/transfer_manager/api/openapi.yaml` (pack: `docs/openapi/transfer_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed default sftp endpoint
- `POST /api/v1/endpoints` — Create an endpoint ({ project_id, name, ... })
- `GET /api/v1/endpoints` — List endpoints (?project_id=)
- `GET /api/v1/endpoints/:id` — Get one endpoint
- `PATCH`/`PUT /api/v1/endpoints/:id` — Update an endpoint
- `DELETE /api/v1/endpoints/:id` — Delete an endpoint
- `POST /api/v1/endpoints/:id/put` — Write an object via storage_manager
- `POST /api/v1/endpoints/:id/get` — Read an object via storage_manager

SDK: `client.resource('transfer_manager', 'endpoints')`. CLI: `aerekos transfer_manager endpoints …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

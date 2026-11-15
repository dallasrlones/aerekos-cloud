# Agent prompt — vpn_manager

VPN peer records plus Headscale preauth keys when `HEADSCALE_URL` + `HEADSCALE_API_KEY` are set; otherwise status/preauth report not-hooked-up. No production skip-fakes (`assertNoSkipFakes` on boot). **Tutorial:** none standalone; console ManagerConsole (no CONSOLE_GUIDES entry).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/vpn_manager{path}`

**Port:** `3147` · **OpenAPI:** `worker/vpn_manager/api/openapi.yaml` (pack: `docs/openapi/vpn_manager.yaml`)

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `GET /api/v1/status` — Headscale hookup status
- `POST /api/v1/ensure-defaults` — Seed default laptop peer if missing
- `POST /api/v1/peers` — Create a peer ({ project_id, name, ... })
- `GET /api/v1/peers` — List peers (?project_id=)
- `GET /api/v1/peers/:id` — Get one peer
- `PATCH`/`PUT /api/v1/peers/:id` — Update a peer
- `DELETE /api/v1/peers/:id` — Delete a peer
- `POST /api/v1/preauth-keys` — Create a Headscale preauth key (or not-hooked-up)

SDK: `client.resource('vpn_manager', 'peers')`. CLI: `aerekos vpn_manager peers …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
Live conductor/proxy e2e parked until stack is up; live Headscale needs `HEADSCALE_URL` + `HEADSCALE_API_KEY`.

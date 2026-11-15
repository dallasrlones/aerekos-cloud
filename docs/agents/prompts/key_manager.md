# Agent prompt — key_manager

Key management service: symmetric/data keys, envelope encryption, rotation. Backs storage + secrets encryption.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/key_manager{path}`

**Port:** `3102` · **OpenAPI:** `docs/openapi/key_manager.yaml` · **Tutorial:** none (Key Manager ServiceGuide in conductor).

## Health

- `GET /health` — liveness (no projectId via conductor `isLiveness`)
- `GET /ready` — readiness (DB + MASTER_KEY)

## Endpoints

- `POST /api/keys` — Create a key ({ name, type, algorithm })
- `GET /api/keys` — List keys
- `GET /api/keys/:name` — Get a key (authorized callers may receive key_material)
- `POST /api/keys/:name/rotate` — Rotate a key
- `POST /api/keys/:name/archive` — Archive a key
- `DELETE /api/keys/:name` — Delete a key

## SDK / CLI

Generic only: `client.proxy('key_manager', …)` · `aerekos call key_manager …`

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

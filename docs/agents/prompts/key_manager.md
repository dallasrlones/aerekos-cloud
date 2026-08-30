# Agent prompt — key_manager

Key management service: symmetric/data keys, envelope encryption, rotation. Backs storage + secrets encryption.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/key_manager{path}`

## Endpoints

- `POST /api/keys` — Create a key ({ name, type, algorithm })
- `GET /api/keys` — List keys
- `GET /api/keys/:name` — Get a key (no secret material)
- `POST /api/keys/:name/rotate` — Rotate a key

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

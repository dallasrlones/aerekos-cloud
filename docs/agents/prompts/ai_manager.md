# Agent prompt — ai_manager

Intelligence endpoints, providers, STT/TTS, usage. Invoke via pretty gateway URLs or the SDK.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/ai_manager{path}`

Provider note: LLM endpoint/URL + provider keys (e.g. Ollama URL) to run inference.

## Endpoints

- `POST /api/v1/intelligence` — Create a intelligence ({ project_id, name, ... })
- `GET /api/v1/intelligence` — List intelligence (?project_id=)
- `GET /api/v1/intelligence/:id` — Get one intelligence
- `PATCH /api/v1/intelligence/:id` — Update a intelligence
- `DELETE /api/v1/intelligence/:id` — Delete a intelligence

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

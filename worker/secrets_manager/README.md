# Secrets Manager

Store and retrieve **project-scoped** secrets; envelope encryption via **`key_manager`** (AES-256-GCM). **List never returns plaintext.**

## Status

**Implemented (MVP)** — `StoredSecret` in SQLite, REST under `/api/v1/secrets*`. Get with **`?reveal=1`** for plaintext when policy allows; **`GET /api/v1/secrets/values`** returns a name→plaintext map for an environment (service-to-service). See [`plan.md`](./plan.md) and OpenAPI [`docs/openapi/secrets_manager.yaml`](../../docs/openapi/secrets_manager.yaml).

**Conductor UI:** Key Manager → **Service secrets** — includes an in-app **ServiceGuide** (not a separate docs tutorial). Proxied as `/api/services/secrets_manager/api/v1/*`.

**Tutorial:** none (standalone). Use the conductor ServiceGuide + this README / OpenAPI.

**Deploy:** On **enable** of `tunnel_manager` / `domain_manager` for a project, the conductor reads matching project secrets and injects them as `CLOUDFLARE_*` into the container env (see `conductor/api/services/projectSecretEnv.js`). **Re-enable** the service after changing a secret value.

## No production mocks

`MOCK_KEY_MANAGER=true` is for **tests and local-only** envelope crypto without conductor/`key_manager`. The process **exits** if `NODE_ENV=production` and `MOCK_KEY_MANAGER=true`. Never commit real secret values; use `.env` (gitignored) and project secrets in the store.

## Quick start (local)

```bash
cd worker/secrets_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3107/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` + `SERVICE_TOKEN` for auto-registration and real `key_manager` envelopes. Optional local: `MOCK_KEY_MANAGER=true` (not for production).

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Crypto, validation, ARN, prod-mock guard |
| Integration | `npm run test:integration` | supertest against exported app |
| E2E (process-local) | `npm run test:e2e` | Full lifecycle under `tests/e2e/` |
| Live stack | `tests/e2e/README.md` | Conductor proxy / registry checklist |
| Coverage | `npm run test:coverage` | |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/secrets | Create secret (`name`, `value`, optional `environment`) |
| GET | /api/v1/secrets?project_id= | List (values redacted) |
| GET | /api/v1/secrets/values?project_id=&environment= | Name→plaintext map |
| GET | /api/v1/secrets/:id?project_id=&reveal=1 | Get (optional plaintext) |
| PATCH | /api/v1/secrets/:id?project_id= | Update |
| DELETE | /api/v1/secrets/:id?project_id= | Delete |

Scope with `project_id` (query, body, or `X-Project-Id`). Default environment is **`prod`**.

## SDK / CLI

No dedicated typed SDK client for this manager yet. Use the generic conductor proxy:

**SDK (Node)** — `client.proxy('secrets_manager', { method, path, projectId, body })`

**CLI** — `aerekos call secrets_manager POST "/api/v1/secrets" --project $PID --data '{"name":"demo","value":"…"}'`

In-process helpers for other workers: `worker/shared/secretsClient.js` (`getSecretValue`).

## Related services

- **key_manager** — envelope data keys (required in non-mock mode)
- **Conductor** — routing, registry, auth, project secret env injection
- **Worker** — container lifecycle

See root [`plan.md`](../../plan.md) for the full platform map.

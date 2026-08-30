# Secrets Manager

Store and retrieve secrets; envelope encryption via **`key_manager`** when configured (or **`MOCK_KEY_MANAGER`** in tests).

## Status

**MVP** — `StoredSecret` in SQLite, REST under `/api/v1/secrets*`. **List** does not return secret values; use **`?reveal=1`** on get when policy allows. See [`plan.md`](./plan.md).

**Conductor UI:** Key Manager screen → **Service secrets (API tokens)** (enable `secrets_manager`, then list/create; presets for Cloudflare in **Add secret**). Proxied as `/api/services/secrets_manager/api/v1/*`.

**Deploy:** On **enable** of `tunnel_manager` / `domain_manager` for a project, the conductor reads matching project secrets and injects them as `CLOUDFLARE_*` into the container env (see `conductor/api/services/projectSecretEnv.js`). **Re-enable** the service after changing a secret value.

## Quick start (local)

```bash
cd worker/secrets_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3107/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | Extend `tests/unit/` |
| Integration | `npm run test:integration` | supertest against exported app |
| Coverage | `npm run test:coverage` | |
| E2E | `tests/e2e/README.md` | Manual + optional CI |

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Liveness (SQLite) |
| GET | /ready | Readiness |
| GET | /api/v1/info | Service metadata (`status: "active"`) |
| POST | /api/v1/secrets | Create secret |
| GET | /api/v1/secrets?project_id= | List (values redacted) |
| GET | /api/v1/secrets/:id?project_id=&reveal=1 | Get (optional `reveal=1` for plaintext) |
| PATCH | /api/v1/secrets/:id?project_id= | Update |
| DELETE | /api/v1/secrets/:id?project_id= | Delete |

## Related services

- **Conductor** — routing, registry, auth
- **Worker** — container lifecycle
- See root [`plan.md`](../../plan.md) for full platform map

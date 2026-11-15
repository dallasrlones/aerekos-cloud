# Auth Manager

Project-scoped **identity**: OIDC provider *metadata*, **app credentials** (`client_credentials`), **per-project users** (password grant), and **JWT issue/verify**. Complements conductor human JWTs; store real IdP `client_secret` in [`secrets_manager`](../secrets_manager/).

## Status

**Implemented (MVP+)** — SQLite via `aerekos-record` (`OidcProvider`, `Credential`, `User`); REST under `/api/v1/*`. Signing secret prefers key_manager via secrets_manager (`auth_manager.signing_secret`); env/dev fallbacks are boot-only, not production mocks. No `MOCK_*` flags. See [`plan.md`](./plan.md) for backlog (live OIDC federation, rate-limit polish).

## Quick start (local)

```bash
cd worker/auth_manager
cp .env_example .env
npm install
npm start
# curl http://localhost:3116/health
```

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration. Optional: `AUTH_MANAGER_SECRET` / `JWT_SECRET`, `CONDUCTOR_CLIENT_SECRET`, `AUTH_CLIENTS` JSON, TTLs.

## Health / proxy

| Path | Behavior |
|------|----------|
| `GET /health`, `GET /ready` | SQLite liveness/readiness; conductor **exempts** these from `projectId` |
| Port | **3116** (`managerServicePorts.auth_manager`) |
| Proxy | `{VERB} {CONDUCTOR}/api/services/auth_manager{path}` |
| `/api/v1/auth/token` | Conductor allows **without inbound Bearer** (chicken-and-egg); uses `proxyServiceRequestWithoutProject` |

## API

Project-scoped CRUD needs `project_id` (query, body, or `X-Project-Id`).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (SQLite) |
| GET | `/ready` | Readiness |
| GET | `/api/v1/info` | Metadata (`status: "active"`) |
| CRUD | `/api/v1/providers` | OIDC provider metadata |
| CRUD + rotate | `/api/v1/credentials` | App credentials |
| CRUD | `/api/v1/users` | Project users |
| POST | `/api/v1/auth/token` | `client_credentials` → access_token |
| POST | `/api/v1/auth/login` | Password grant → user JWT |
| POST | `/api/v1/auth/verify` | Introspect token |
| POST | `/api/v1/auth/introspect` | RFC 7662-style alias |
| GET | `/metrics` | Prometheus |

**OpenAPI:** [`api/openapi.yaml`](./api/openapi.yaml)

## SDK / CLI

Typed helpers exist on the Node SDK (`client.users`, `client.auth.getAppToken` / `createCredential`). No dedicated `aerekos auth …` verbs — use generic call or SDK:

```js
await client.users.create(PID, { username: 'demo', password: 'hunter22', name: 'Demo' });
const { token } = await client.users.login({ username: 'demo', password: 'hunter22', projectId: PID });
await client.users.verify(token);

await client.auth.createCredential(PID, { name: 'app', scopes: ['ai:InvokeLlm'], allowed_resources: [ARN] });
await client.auth.getAppToken({ clientId, clientSecret, projectId: PID });
```

```bash
aerekos call auth_manager POST "/api/v1/users" --project $PID \
  --data '{"project_id":"'"$PID"'","username":"demo","password":"hunter22"}'
aerekos call auth_manager POST "/api/v1/auth/login" --project $PID \
  --data '{"project_id":"'"$PID"'","username":"demo","password":"hunter22"}'
```

Catalog entry: `aerekos-sdk/managers.generated.js` → `auth_manager`.

## Tutorial / ServiceGuide

**Tutorial: none** (no standalone tutorial under `docs/tutorials`). Console has a dedicated **AuthManager** screen (`conductor/app/screens/AuthManager`) — not a generic `CONSOLE_GUIDES` entry. No separate ServiceGuide component on that screen.

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | TokenService sign/verify |
| Integration | `npm run test:integration` | Health, providers CRUD, credentials→token, users lifecycle |
| E2E (local) | `npm run test:e2e` | `tests/e2e/authFlow.test.js` in-process |
| E2E (live) | `tests/e2e/README.md` | Conductor proxy / fleet |

## Related

- Conductor — proxy, `client_credentials` for gated managers, validate-token
- key_manager / secrets_manager — signing secret + IdP secrets
- Docs: [`docs/services/auth_manager.md`](../../docs/services/auth_manager.md)

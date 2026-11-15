# auth_manager — Cognito

> **Identity** · Implemented

OIDC provider metadata, app credentials (`client_credentials`), per-project users (password grant), and JWT issue/verify. Keep live IdP `client_secret` in secrets_manager — this service stores metadata only.

- **Port:** `3116`
- **AWS analog:** Cognito
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/auth_manager{path}` (JWT or service token)
- **Capabilities:** `oidc`, `identity-providers`, `credentials`, `users`, `tokens`
- **OpenAPI:** [`worker/auth_manager/api/openapi.yaml`](../../worker/auth_manager/api/openapi.yaml)
- **Mocks:** none in production paths (SQLite store; signing secret from KMS/`AUTH_MANAGER_SECRET` fallback — not a `MOCK_*` flag)
- **Health/proxy:** `/health` + `/ready` skip `projectId`; `/api/v1/auth/token` allowed without inbound Bearer

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/providers` | Create OIDC provider metadata |
| `GET` | `/api/v1/providers` | List providers |
| `GET` | `/api/v1/providers/:id` | Get provider |
| `PATCH` | `/api/v1/providers/:id` | Update provider |
| `DELETE` | `/api/v1/providers/:id` | Delete provider |
| `POST` | `/api/v1/credentials` | Create app credential |
| `GET` | `/api/v1/credentials` | List credentials |
| `GET` | `/api/v1/credentials/:id` | Get credential |
| `PATCH` | `/api/v1/credentials/:id` | Update credential |
| `DELETE` | `/api/v1/credentials/:id` | Delete credential |
| `POST` | `/api/v1/credentials/:id/rotate` | Rotate client_secret |
| `POST` | `/api/v1/users` | Create project user |
| `GET` | `/api/v1/users` | List users |
| `GET` | `/api/v1/users/:id` | Get user |
| `PATCH` | `/api/v1/users/:id` | Update user |
| `DELETE` | `/api/v1/users/:id` | Delete user |
| `POST` | `/api/v1/auth/token` | client_credentials → access_token |
| `POST` | `/api/v1/auth/login` | Password grant → user JWT |
| `POST` | `/api/v1/auth/verify` | Verify token |
| `POST` | `/api/v1/auth/introspect` | RFC 7662-style introspect |

All project-scoped CRUD requires `project_id` (query, body, or `X-Project-Id`).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_MANAGER_SECRET` | (KMS preferred) | Boot fallback signing secret; prod uses `auth_manager.signing_secret` via secrets_manager |
| `CONDUCTOR_CLIENT_SECRET` | (KMS preferred) | `conductor` client_credentials peer secret |

## SDK / CLI

SDK helpers: `client.users.*`, `client.auth.getAppToken` / `createCredential`. No dedicated `aerekos auth …` verbs — use generic call:

**SDK (Node)**

```js
await client.users.create(PID, { username: 'demo', password: 'hunter22' });
const { token } = await client.users.login({ username: 'demo', password: 'hunter22', projectId: PID });
await client.auth.getAppToken({ clientId, clientSecret, projectId: PID });
```

**CLI**

```bash
aerekos call auth_manager POST "/api/v1/users" --project $PID \
  --data '{"project_id":"'"$PID"'","username":"demo","password":"hunter22"}'
```

## Tutorial / ServiceGuide

**Tutorial: none.** Console **AuthManager** screen exists (`conductor/app/screens/AuthManager`); no standalone tutorial under `docs/tutorials`.

## Examples

**curl**

```bash
curl -s -X POST \
  "$CONDUCTOR/api/services/auth_manager/api/v1/providers?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","provider_type":"oidc"}'
```

---

_Honesty pass for `mgr-auth_manager`. Catalog updated; run `make docs` when regenerating from `docs/catalog.js`._

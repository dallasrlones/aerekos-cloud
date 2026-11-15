# secrets_manager — Secrets Manager

> **Identity** · Implemented

Encrypted secrets (AES-256-GCM envelope via key_manager). List never returns plaintext; ?reveal=1 or GET /secrets/values for plaintext.

- **Port:** `3107`
- **AWS analog:** Secrets Manager
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/secrets_manager{path}` (JWT or service token)
- **Capabilities:** `secrets`, `encryption`
- **OpenAPI:** [`docs/openapi/secrets_manager.yaml`](../openapi/secrets_manager.yaml)
- **Tutorial:** none (standalone). Conductor Key Manager → Service secrets has an in-app ServiceGuide.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/secrets` | Create a secret ({ name, value }, optional environment) |
| `GET` | `/api/v1/secrets` | List secrets (no values; optional environment) |
| `GET` | `/api/v1/secrets/values` | Name→plaintext map for an environment |
| `GET` | `/api/v1/secrets/:id` | Get a secret (?reveal=1 for value) |
| `PATCH` | `/api/v1/secrets/:id` | Update a secret |
| `DELETE` | `/api/v1/secrets/:id` | Delete a secret |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_KEY_MANAGER` | `false` | Tests/local only; refused when NODE_ENV=production |
| `CONDUCTOR_URL` | | Required for key_manager envelopes unless MOCK_KEY_MANAGER |
| `SERVICE_TOKEN` | | Service token for key_manager via conductor |
| `SECRETS_ENCRYPTION_KEY_NAME` | `secrets-envelope-key` | key_manager key name for envelopes |

## SDK / CLI

No dedicated typed client. Use generic proxy / CLI:

```bash
aerekos call secrets_manager POST "/api/v1/secrets" --project $PID --data '{"name":"demo","value":"…"}'
```

```js
await client.proxy('secrets_manager', {
  method: 'POST',
  path: '/api/v1/secrets',
  projectId: PID,
  body: { name: 'demo', value: '…' },
});
```

Worker helper: `worker/shared/secretsClient.js` (`getSecretValue`).

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/secrets_manager/api/v1/secrets?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","value":"replace-me"}'
```

---

_Generated from `docs/catalog.js` (honesty pass for mgr-secrets_manager). Edit the catalog and run `make docs` to refresh; keep OpenAPI + SDK/CLI notes accurate._

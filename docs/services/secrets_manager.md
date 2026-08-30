# secrets_manager — Secrets Manager

> **Identity** · Implemented

Encrypted secrets (AES-256-GCM envelope via key_manager). List never returns plaintext; ?reveal=1 for value.

- **Port:** `3107`
- **AWS analog:** Secrets Manager
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/secrets_manager{path}` (JWT or service token)
- **Capabilities:** `secrets`, `encryption`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/secrets` | Create a secret ({ name, value }) |
| `GET` | `/api/v1/secrets` | List secrets (no values) |
| `GET` | `/api/v1/secrets/:id` | Get a secret (?reveal=1 for value) |
| `PATCH` | `/api/v1/secrets/:id` | Update a secret |
| `DELETE` | `/api/v1/secrets/:id` | Delete a secret |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `MOCK_KEY_MANAGER` | `true (compose)` | Local dev key instead of key_manager |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/secrets_manager/api/v1/secrets?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('secrets_manager', { method: 'POST', path: '/api/v1/secrets', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call secrets_manager POST "/api/v1/secrets" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

# key_manager — KMS

> **Core** · Implemented

Key management service: symmetric/data keys, envelope encryption, rotation. Backs storage + secrets encryption.

- **Port:** `3002`
- **AWS analog:** KMS
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/key_manager{path}` (JWT or service token)
- **Capabilities:** `kms`, `encryption`, `keys`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/keys` | Create a key ({ name, type, algorithm }) |
| `GET` | `/api/keys` | List keys |
| `GET` | `/api/keys/:name` | Get a key (no secret material) |
| `POST` | `/api/keys/:name/rotate` | Rotate a key |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `MASTER_KEY` | `-` | 64 hex chars (AES-256 master key). Required. |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/key_manager/api/keys?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('key_manager', { method: 'POST', path: '/api/keys', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call key_manager POST "/api/keys" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

# key_manager — KMS

> **Core** · Implemented

Key management service: symmetric/data keys, envelope encryption, rotation. Backs storage + secrets encryption.

- **Port:** `3102` (matches `conductor/api/config/managerServicePorts.js`)
- **AWS analog:** KMS
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/key_manager{path}` (JWT or service token)
- **Capabilities:** `kms`, `encryption`, `keys`
- **OpenAPI:** [`docs/openapi/key_manager.yaml`](../openapi/key_manager.yaml) · catalog pack [`ga-managers.generated.yaml`](../openapi/ga-managers.generated.yaml)
- **Tutorial:** none standalone. Conductor **Key Manager** screen has an in-app ServiceGuide.

## Health / proxy

| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/health` | Liveness (SQLite). Conductor proxy treats `/health` and `/ready` as **isLiveness** (no `projectId` required). |
| `GET` | `/ready` | Readiness (DB + `MASTER_KEY` loaded). |

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/info` | Service metadata (unauthenticated) |
| `POST` | `/api/keys` | Create a key ({ name, type, algorithm }) |
| `GET` | `/api/keys` | List keys |
| `GET` | `/api/keys/:name` | Get a key (authorized callers receive `key_material`) |
| `POST` | `/api/keys/:name/rotate` | Rotate a key |
| `POST` | `/api/keys/:name/archive` | Archive a key (mark inactive) |
| `DELETE` | `/api/keys/:name` | Delete a key (all versions) |

Global key-store paths under `/api/keys*` may omit `projectId` on the conductor proxy (platform KMS store).

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3102` | Listen port |
| `MASTER_KEY` | `-` | 64 hex chars (AES-256). Required; all-zero dummy refused when `NODE_ENV=production` |
| `CONDUCTOR_URL` | | Auto-registration |
| `DATABASE_PATH` | `/app/data/key_manager.db` | SQLite key store |

## No production mocks

This service **is** the KMS. Downstream managers may set `MOCK_KEY_MANAGER` for local tests only — never in production. `key_manager` itself refuses a missing or all-zero `MASTER_KEY` when `NODE_ENV=production`.

## SDK / CLI

No dedicated typed SDK client. Use the generic conductor proxy:

```js
await client.proxy('key_manager', {
  method: 'POST',
  path: '/api/keys',
  projectId: PID,
  body: { name: 'demo', type: 'symmetric', algorithm: 'AES-256-GCM' },
});
```

```bash
aerekos call key_manager POST "/api/keys" --project $PID \
  --data '{"name":"demo","type":"symmetric","algorithm":"AES-256-GCM"}'
```

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/key_manager/api/keys?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name":"demo","type":"symmetric","algorithm":"AES-256-GCM"}'
```

**Liveness (no projectId):**

```bash
curl -sf "$CONDUCTOR/api/services/key_manager/health"
curl -sf "$CONDUCTOR/api/services/key_manager/ready"
```

---

_Generated from `docs/catalog.js` (honesty pass for mgr-key_manager). Edit the catalog and run `make docs` / `node scripts/oss/gen-openapi-from-catalog.mjs` to refresh._

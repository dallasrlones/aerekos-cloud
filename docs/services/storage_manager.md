# storage_manager — S3

> **Core** · Implemented

Object storage: buckets + objects with envelope encryption via **key_manager**, multipart/chunked uploads, and signed URLs.

- **Port:** `3003`
- **AWS analog:** S3
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/storage_manager{path}` (JWT or service token)
- **Auth:** Bearer required. Accepts conductor `POST /api/services/validate-token` **or** `auth_manager` verify (`AUTH_REQUIRED=true` in compose; key_manager readiness fails hard when required).
- **Capabilities:** `object-storage`, `buckets`, `signed-urls`, `encryption`
- **OpenAPI:** [`worker/storage_manager/api/openapi.yaml`](../../worker/storage_manager/api/openapi.yaml) · pack fragment in [`docs/openapi/ga-managers.generated.yaml`](../openapi/ga-managers.generated.yaml)
- **Tutorial:** none (standalone). No conductor ServiceGuide for this manager.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/projects/:projectId/buckets` | Create a bucket |
| `GET` | `/api/projects/:projectId/buckets` | List buckets |
| `GET` | `/api/projects/:projectId/buckets/:bucket` | Get a bucket |
| `DELETE` | `/api/projects/:projectId/buckets/:bucket` | Delete a bucket |
| `POST` | `/api/projects/:projectId/buckets/:bucket/files/:key` | Upload an object |
| `GET` | `/api/projects/:projectId/buckets/:bucket/files/:key` | Download an object |
| `GET` | `/api/projects/:projectId/buckets/:bucket/files` | List objects |
| `POST` | `/api/projects/:projectId/buckets/:bucket/files/:key/signed-url/download` | Create a signed download URL |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `STORAGE_PATH` | `./storage` | Where object bytes are stored |
| `AUTH_REQUIRED` | `true` (compose) | Fail start if key_manager health via conductor fails; routes always need Bearer |
| `MOCK_KEY_MANAGER` | `false` | Local/tests only; **refused** when `NODE_ENV=production` |
| `CONDUCTOR_URL` | | Required for key_manager health + encryption (non-mock) |

## SDK / CLI

No dedicated typed SDK client. Use generic conductor proxy:

**SDK (Node)**

```js
await client.proxy('storage_manager', {
  method: 'POST',
  path: '/api/projects/:projectId/buckets',
  projectId: PID,
  body: { name: 'demo' },
});
```

**CLI**

```bash
aerekos call storage_manager POST "/api/projects/:projectId/buckets" --project $PID --data '{"name":"demo"}'
```

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/storage_manager/api/projects/:projectId/buckets?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

---

_Honesty pass for `mgr-storage_manager`. Catalog env keys should match `STORAGE_PATH` / prod mock policy; run `make docs` when regenerating from `docs/catalog.js`._

# storage_manager — S3

> **Core** · Implemented

Object storage: buckets + objects with envelope encryption, multipart/chunked uploads, and signed URLs.

- **Port:** `3003`
- **AWS analog:** S3
- **Proxy base:** `/api`
- **Access:** `{VERB} {CONDUCTOR}/api/services/storage_manager{path}` (JWT or service token)
- **Capabilities:** `object-storage`, `buckets`, `signed-urls`, `encryption`

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
| `STORAGE_ROOT` | `./data` | Where object data is stored |
| `MOCK_KEY_MANAGER` | `false` | Use a local dev key instead of key_manager |

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

**SDK (Node)**

```js
// generic proxy
await client.proxy('storage_manager', { method: 'POST', path: '/api/projects/:projectId/buckets', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call storage_manager POST "/api/projects/:projectId/buckets" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

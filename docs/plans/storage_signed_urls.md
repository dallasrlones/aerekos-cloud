# storage_manager — signed URL design note

> **Status:** Design — W11 platform finish  
> **Navigation:** [storage_manager plan](./storage_manager.md) · [identity](../architecture/identity.md)

## Goals

- Time-limited **GET** (download) and **PUT** (upload) URLs without exposing conductor JWT to browsers or CDNs.
- Same authorization as proxy routes: app credential scopes + bucket/object ARN.
- Audit every minted URL (who, ARN, TTL, purpose).

## URL shapes

| Kind | Method | Example path |
|------|--------|----------------|
| Download | `GET` | `/api/v1/objects/signed-download?project_id=&bucket=&key=&expires=` |
| Upload | `PUT` | `/api/v1/objects/signed-upload?project_id=&bucket=&key=&expires=` |

Response:

```json
{
  "url": "https://cloudapi.example/v1/.../objects/...?sig=...&exp=...",
  "expires_at": "2026-11-13T12:00:00.000Z",
  "headers": { "x-amz-meta-project-id": "..." }
}
```

Pretty URLs may later route through `api_manager` → `storage_manager` origin; signature validation stays in storage_manager.

## Signing model (v1)

| Input | Source |
|-------|--------|
| Secret | `key_manager` envelope key per project (not `JWT_SECRET`) |
| Payload | `project_id`, `bucket`, `key`, `method`, `exp` (unix), optional `content-type` |
| Algorithm | HMAC-SHA256 over canonical string; `sig` query param base64url |

Validation middleware:

1. Parse `exp`; reject if skew > 60s or expired.
2. Recompute HMAC; constant-time compare.
3. Enforce scope: `storage:GetObject` / `storage:PutObject` on ARN.
4. Stream object from bucket backing store (local FS or future S3 adapter).

## TTL policy

| Surface | Default max TTL | Notes |
|---------|-----------------|-------|
| Console “Copy link” | 15 minutes | Shown in UI |
| App credential API | 1 hour | Configurable per credential |
| CI / tests | 5 minutes | `SIGNED_URL_TTL_CAP_SECONDS` env |

## Security

- Never log full `sig` or pre-signed query strings in access logs (log ARN + credential id only).
- Rate-limit mint endpoints (`worker/shared/rateLimit.js`).
- CORS on download URLs: bucket CORS config applies at CDN edge when using Cloudflare.

## Implementation checklist

- [ ] `SignedUrlService.mint({ method, bucket, key, ttlSeconds, credential })`
- [ ] `GET` handler bypasses Bearer when valid `sig`+`exp` present
- [ ] Conductor proxy: do not strip query params on forward
- [ ] Console StorageManager: “Signed download link” with TTL picker
- [ ] OpenAPI fragment in `docs/openapi/storage_manager.yaml`
- [ ] Unit tests: expired sig, wrong bucket, scope denied

## Related

- `MOCK_KEY_MANAGER=false` prod path — signing secret must come from live KMS path ([storage_manager plan](./storage_manager.md)).
- Edge delivery: optional Cloudflare cache in front of signed GETs ([edge-providers](../architecture/edge-providers.md)).

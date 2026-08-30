# Agent prompt — storage_manager

Object storage: buckets + objects with envelope encryption, multipart/chunked uploads, and signed URLs.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/storage_manager{path}`

## Endpoints

- `POST /api/projects/:projectId/buckets` — Create a bucket
- `GET /api/projects/:projectId/buckets` — List buckets
- `GET /api/projects/:projectId/buckets/:bucket` — Get a bucket
- `DELETE /api/projects/:projectId/buckets/:bucket` — Delete a bucket
- `POST /api/projects/:projectId/buckets/:bucket/files/:key` — Upload an object
- `GET /api/projects/:projectId/buckets/:bucket/files/:key` — Download an object
- `GET /api/projects/:projectId/buckets/:bucket/files` — List objects
- `POST /api/projects/:projectId/buckets/:bucket/files/:key/signed-url/download` — Create a signed download URL

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

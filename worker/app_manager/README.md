# App Manager

App project metadata, FE scaffold for Icarus IDE, and deploy hooks (compute/cicd/tunnel).

## Status

**Active** — project-scoped CRUD, `POST /api/v1/apps/scaffold` (FE starter for Icarus IDE), `/health`, `/ready`, `/api/v1/info`, `/metrics`. Deploy is via compute_manager / cicd_manager / tunnel_manager after scaffold.

## Quick start (local)

```bash
cd worker/app_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3125/health
```

## Scaffold (Icarus Flows)

```bash
curl -s -X POST "$CONDUCTOR/api/services/app_manager/api/v1/apps/scaffold?project_id=$PROJECT_ID" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"fe","template":"admin_crud"}'
```

Opens in **Icarus IDE** (`/icarus/ide`) after Flow confirm.

## Environment

See [`.env_example`](./.env_example). Set `CONDUCTOR_URL` for auto-registration with the conductor.

## Testing

| Layer | Command |
|-------|---------|
| Unit | `npm run test:unit` |
| Integration | `npm run test:integration` |

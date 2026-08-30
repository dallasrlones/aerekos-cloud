# Webhook Manager

**Outbound** webhooks: register URLs, dispatch JSON payloads, and record delivery results. Set **`SKIP_OUTBOUND=1`** in tests to avoid real HTTP and log a `skipped` delivery.

## Status

**MVP** — project-scoped webhooks, dispatch, delivery log, `GET /metrics`. See [`plan.md`](./plan.md) for follow-ups.

## Default port

**`3112`**

## Quick start (local)

```bash
cd worker/webhook_manager
cp .env_example .env
npm install
npm run dev
# curl http://localhost:3112/health
```

## Environment

See [`.env_example`](./.env_example). Notable: `SKIP_OUTBOUND=1` (Jest/CI), `WEBHOOK_HTTP_TIMEOUT_MS` (default 15000), `CONDUCTOR_URL` for registration.

## API

`project_id`: query, body, or `X-Project-Id`.

| Method | Path | Description |
|--------|------|-------------|
| GET | /health, /ready | Liveness; readiness (SQLite) |
| GET | /api/v1/info | Service metadata |
| GET | /metrics | Prometheus text |
| POST/GET/DELETE | /api/v1/webhooks | CRUD webhooks (unique `name` per project) |
| POST | /api/v1/webhooks/:id/dispatch | Send payload; optional `X-Aerekos-Webhook-Secret` if configured |
| GET | /api/v1/webhooks/:id/deliveries?project_id= | Delivery history |

## Docker

Build context is the parent `worker/` directory:

```bash
docker compose -f docker-compose.yml up --build
```

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| All | `npm test` | |
| E2E | [`tests/e2e/README.md`](./tests/e2e/README.md) | Manual / optional |

## Related

- Port index: [`../MANAGER_SERVICES.md`](../MANAGER_SERVICES.md)
- `new_service.md` at repo root for patterns shared across managers

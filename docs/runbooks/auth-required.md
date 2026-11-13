# AUTH_REQUIRED (manager auth flip)

`AUTH_REQUIRED` gates whether worker **managers** reject unauthenticated HTTP on their **direct** listen ports (`:3003`, `:3004`, `:3107`, …). It does **not** replace conductor `appProxyAuth`; both layers matter for W3.

## Behavior

Implemented in `worker/shared/authManagerClient.js` (`requireAuth()`):

| `AUTH_REQUIRED` | Direct manager port | Conductor proxy (`/api/services/…`) |
|-----------------|---------------------|-------------------------------------|
| `true` | 401 without valid Bearer verified by auth_manager | Still requires `appProxyAuth` (user / app / service token) |
| not `true` | Listens and may serve without auth (homelab / migration) | Same conductor rules |

When `true`, tokens are checked against `AUTH_MANAGER_URL` (`POST /api/v1/auth/verify`). Invalid or missing tokens → **401**, not silent pass.

## Compose wiring (prod flip)

Core managers in `docker-compose.core.yml` already pass:

```yaml
- AUTH_REQUIRED=${AUTH_REQUIRED:-true}
```

Default in that file is **`true`** when the variable is unset. Homelab stacks that intentionally leave managers open set in `.env`:

```bash
AUTH_REQUIRED=false
```

**Prod / GA checklist:** set explicitly in the prod env file:

```bash
AUTH_REQUIRED=true
```

Redeploy **only** the affected manager containers after changing env (no secret rotation required for this flip):

```bash
cd ~/work/aerekos/aerekos-cloud
docker compose -f docker-compose.core.yml up -d --no-deps storage_manager secrets_manager db_manager api_manager auth_manager
# extend list to every manager service that exposes :31xx in your stack
```

Worker-hosted managers (Orin AI stack, etc.) use the same variable—see `worker/docker-compose.ai.yml` (`AI_AUTH_REQUIRED` alias on some profiles).

## Verification (no live secret changes)

1. **Unit (storage_manager):** `worker/storage_manager/tests/integration/auth-required.test.js` with `AUTH_REQUIRED=true`.
2. **Conductor unit:** `conductor/tests/unit/requireIamAccess.test.js` (IAM deny → 403 at proxy when enforcement is on).
3. **Live e2e:** With `AUTH_REQUIRED=true` on a staging manager, `curl` direct port without `Authorization` → 401; same route via conductor with app token → 200/expected status.

```bash
# Example direct-port probe (adjust host/port)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3107/health
# Expect 401 on protected routes when AUTH_REQUIRED=true; /health may stay open per manager
```

Use **app credentials** from `e2e/lib/icarusLive.js` `mintAppToken()` for proxy tests—not placeholder env tokens (`replace-*`, `changeme`).

## Rollback

Set `AUTH_REQUIRED=false` in env and recreate managers. Use only for debugging; do not leave false on prod GA hosts (direct-port bypass in [threat-model.md](../threat-model.md)).

## Related

- [identity.md](../architecture/identity.md) — human vs app vs service tokens
- [mixed-stack.md](mixed-stack.md) — prod-mini compose split
- [icarus-c0.md](icarus-c0.md) — app tokens for Icarus smoke

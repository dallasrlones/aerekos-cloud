# Runbook — Incident response

## Manager unhealthy

1. Dashboard → service console → Setup tab — check dependency chain
2. `docker compose -f docker-compose.full.yml ps` on prod-mini
3. `docker compose -f docker-compose.full.yml logs <manager> --tail 200`
4. Conductor returns 503 when manager down — check `SERVICE_DIRECT_HOSTS` for split-host managers (e.g. ai_manager on Orin)

## Auth failures after deploy

1. Verify `AUTH_MANAGER_SECRET` matches between conductor and auth_manager
2. Verify `conductor.client_secret` exists in secrets_manager
3. Check `GET /api/audit?action=auth.login` for failed login spike

## Gateway / app access

1. `GET /api/services/api_manager/setup?project_id=<uuid>` — presets seeded?
2. Re-seed: API Gateway UI → Seed standard presets
3. Run `CONDUCTOR_URL=... make e2e-app-access`

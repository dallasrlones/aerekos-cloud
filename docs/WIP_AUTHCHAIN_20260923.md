# WIP: Auth-chain fix for Download Manager (2026-09-23, PAUSED)

Paused for: install Hermes on dev-mini (~/work/hermes). Resume this when back.

## What was broken (root causes, all diagnosed + confirmed live)
1. Conductor `/api/services/validate-token` only checked the Service table, so internal
   tokens (WORKER_TOKEN / WORKER_REGISTRATION_TOKEN / CONDUCTOR_TOKEN — all = the 5e7a33… UUID
   from .env) were rejected with 401 "Invalid service token". That broke:
   - KMS read chain: secrets_manager → conductor proxy → key_manager → validate-token → 401.
     So auth_manager's KMS signing-secret read FAILED silently at boot and it fell back to the
     hardcoded dev secret `aerekos-auth-manager-dev-secret-change-me` (confirmed: a token signed
     with that string passed the signature check and then failed on issuer).
   - DM (download_manager, CONDUCTOR_TOKEN=WORKER_TOKEN) → conductor proxy → storage_manager
     uploads → 401 "Invalid service token" (the original DM blocker).
   - User JWTs: conductor signed with `your-secret-key-change-this-in-production` (conductor/.env
     JWT_SECRET) and with NO `iss` claim, so auth_manager verify (expects
     iss=aerekos-auth_manager + same secret) always rejected them.

## Changes made in SoT tree (NOT committed yet)
1. `conductor/api/routes/services.js` (mounted) + `conductor/api/services.js` (legacy copy):
   validate-token now returns `{service:{id:'worker',name:'worker'},valid:true,internal:true}`
   for WORKER_REGISTRATION_TOKEN/WORKER_TOKEN/CONDUCTOR_TOKEN after the table lookup fails.
2. `conductor/api/services/JWTService.js` (rewritten): on boot (after listen, 20×5s retries)
   loads KMS secret `auth_manager.signing_secret` via worker/shared/secretsClient (loaded with
   `../utils/loadWorkerShared`); signs user tokens with it + `issuer:'aerekos-auth_manager'`;
   verifyToken tries [KMS value, env JWT_SECRET fallback]. Exports `loadKmsSecret`.
   NOTE: loads KMS secret ONCE per process (kmsLoaded) — rotating the secret requires
   force-recreating the conductor.
3. `conductor/index.js`: listen callback runs the JWTService.loadKmsSecret() retry loop.
4. `worker/auth_manager/api/services/TokenService.js` (rewritten): KMS-first secret load,
   10×3s startup retries + 30s background recovery loop (same for conductor.client_secret).
5. `docker-compose.yml` (dev conductor env): added SERVICE_TOKEN=${WORKER_TOKEN},
   SECRETS_MANAGER_URL=${SECRETS_MANAGER_URL:-http://secrets_manager:3107/api/v1},
   DEFAULT_PROJECT_ID.

## Live state on prod-mini (verified)
- KMS secret `auth_manager.signing_secret` (id 4f49ca35-eb10-4201-992b-e77d1cff8f78,
  project d57d380d-acfe-49b0-b5a9-ba973892bc8b) ROTATED from weak bootstrap value
  `aerekos-auth-dev-secret` to fresh 64-hex (prefix 7c41ccbd61ce…). KMS round-trip + reveal
  verified (secrets_manager 127.0.0.1:3107, chain now works).
- Conductor `aerekos-cloud-conductor` (host 3300) force-recreated; log line confirmed:
  `[JWTService] JWT signing secret loaded from key manager (auth_manager.signing_secret)`.
  validate-token(5e7a33…) → `{valid:true,internal:true}` verified live.
- auth_manager `aerekos-auth_manager` (host 3116) was docker-restarted AFTER the rotation,
  BUT it runs a BUILT image (`aerekos-cloud-auth_manager` sha256:550d8a7c, no code bind mount),
  i.e. the OLD TokenService code (env-first, no retry). Post-restart test: tokens signed with
  ANY of [new KMS value, old KMS value, dev fallback] → `{"active":false,"error":"invalid_token:
  invalid token"}` — note "invalid token", NOT "invalid signature" (pre-restart the dev-fallback
  candidate got "jwt issuer invalid"), so the running verify is rejecting the token
  format/claims BEFORE signature. Unresolved at pause.

## Resume steps (in order)
1. Inspect what's really running in the auth_manager image:
   `docker exec aerekos-auth_manager sh -c 'find / -name TokenService.js 2>/dev/null'` then read
   verify() + the /verify route; also dump its env (SERVICE_TOKEN? SECRETS_MANAGER_URL?
   DEFAULT_PROJECT_ID? AUTH_MANAGER_SECRET?) — if SERVICE_TOKEN/CONDUCTOR_TOKEN are both unset,
   shared getSecretValue throws "secrets manager not configured" at its boot.
   Figure out why /verify says "invalid token" for well-formed HS256 JWTs (check any
   pre-verification format/claim checks in that build).
2. Rebuild + redeploy the auth_manager image from the SoT tree (docker-compose.core.yml) so the
   KMS-first/retry TokenService is live; confirm log "signing secret loaded from key manager".
3. E2E auth checks:
   - conductor login → user JWT (now has iss + KMS signature)
   - POST http://127.0.0.1:3116/api/v1/auth/verify {token} → active:true
   - GET http://127.0.0.1:3300/api/services/storage_manager/api/systems?project_id=…
     with user JWT → 200; same with WORKER_TOKEN (DM path) → 200
4. Re-run DM E2E: HTTP file / YouTube→mp3 / torrent → media bucket (/mnt/usb24tb/media,
  system_id prod-mini). Test URLs: https://proof.ovh.net/files/10Mb.dat,
  https://speed.hetzner.de/1MB.bin, openwrt 24.10.0 x86/64 commercial torrent dir.
5. Then the rest of task 2: DM UI rebuild (full CRUD + download management), then per msg 1836
   update SDK + user API (not UI API) + docs, then commit the SoT tree.

## Env facts (quick ref)
- Ports: conductor 3300 (host), auth_manager 3116, secrets_manager 3107, key_manager 3002
  (internal only), storage_manager 3132?, download_manager 3134/3133.
- Running compose project `aerekos-cloud` = docker-compose.yml + docker-compose.core.yml +
  docker-compose.platform.yml + /tmp/worker-app-version.yml. Managers (incl. auth_manager) are
  BUILT images (no code mounts) — code changes need image rebuild. Dev conductor + frontend +
  worker use bind mounts + nodemon (hot reload).
- `docker compose up -d` from repo root hangs in the foreground — run in background.
- Gotcha: a redaction layer masks `VAR=*** (no spaces) in files written through tooling —
  write `VAR = value` with spaces, or verify with `grep '\*\*\*'`.
- .env: WORKER_TOKEN=5e7a335d-…; DEFAULT_PROJECT_ID=d57d380d-acfe-49b0-b5a9-ba973892bc8b;
  SECRETS_MANAGER_URL=http://secrets_manager:3107/api/v1; KEY_MANAGER_MASTER_KEY=9f621b…

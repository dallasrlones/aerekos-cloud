# Production readiness

Use this as a **starting checklist** for a shared or internet-exposed deployment. Tighten it to your threat model, compliance, and hosting environment.

## Baseline

- [ ] **Secrets**: No real tokens in git; use env vars / a secret store; rotate after any exposure.
- [ ] **Conductor + worker** behind appropriate network controls (private network, VPN, or firewall rules); TLS termination at a reverse proxy or load balancer where clients are untrusted.
- [ ] **SQLite** paths on durable storage; run snapshot jobs through **backup_manager** (`POST /api/v1/jobs` → bucket `aerekos-backups`) and restore via `POST /jobs/:id/restore`.
- [ ] **Docker**: Run images from trusted registries; pin tags for reproducibility; keep host Docker updated **one device at a time** (`POST /api/workers/:id/host/update`). Never `--remove-orphans` or `deploy.sh full` on the mixed homelab stack.
- [ ] **Fail-closed secrets:** `NODE_ENV=production` **throws** on dummy `JWT_SECRET` / `TOKEN_SECRET` (and workers throw on dummy `SIGNED_URL_SECRET` / `KEY_MANAGER_MASTER_KEY`) plus `MOCK_KEY_MANAGER=true` / `SKIP_*` fakes. Rotate live `.env` yourself — deploy scripts do not rewrite it. Set `CONDUCTOR_INTERNAL_BASE_URL` (e.g. `http://aerekos-conductor:3000`) on the conductor container.
- [ ] **Admin seed:** default `admin`/`admin` only when `ALLOW_DEFAULT_ADMIN_SEED=1`.
- [x] **Notify:** send when SMTP/Slack/Twilio/FCM secrets exist; otherwise queue-only.

## Observability

- [ ] Scrape or collect **`GET /metrics`** (Prometheus text) from conductor, worker, and services you operate.
- [ ] Centralize **logs** from conductor, worker, and long-running services; set log retention and access controls.

## Hardening (iterate)

- [ ] **Rate limiting** and auth on any conductor API exposed beyond a trusted network.
- [ ] **Worker registration tokens** — treat like passwords; short-lived or rotatable if your model allows.
- [ ] **Dependency updates**: `npm audit` in root and in each deployed package; plan upgrades for high/critical issues.
- [ ] **Branch protection** and **CI required** on the default branch (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Release

- [ ] **CHANGELOG.md** and git tag (e.g. `v0.1.0`) when you cut a public release; GitHub **Security** advisories for fixes that warrant coordinated disclosure (see [`SECURITY.md`](SECURITY.md)).

## Node version

The repo documents a **minimum Node 20** via [`.nvmrc`](.nvmrc) and `package.json` `engines`. Match production runtimes to that for predictable native addons (e.g. `better-sqlite3`).

## Port layout (managers on one worker)

Each manager is assigned a **unique default host port** in [`conductor/api/config/managerServicePorts.js`](conductor/api/config/managerServicePorts.js) and [`conductor/scripts/seedServices.js`](conductor/scripts/seedServices.js) (must stay in sync). **Core:** `key_manager` 3002, `storage_manager` 3003, `db_manager` 3004, worker agent 3001, conductor 3000. **Edge / ops:** e.g. `secrets_manager` 3107, `tunnel_manager` 3110, `domain_manager` 3111. Do not bind two services to the same host port on one machine.

## Service secrets → container environment

When a **project** enables `tunnel_manager` or `domain_manager`, the conductor can **inject** project secrets (created in the dashboard under **Key Manager → Service secrets**) into the container as `CLOUDFLARE_*` environment variables. Mapping is defined in [`conductor/api/services/projectSecretEnv.js`](conductor/api/services/projectSecretEnv.js) (e.g. `cloudflare_api_token` → `CLOUDFLARE_API_TOKEN`).

- **Prerequisites:** `secrets_manager` is running and **reachable from the conductor**; project secrets exist with the expected names; [`ServiceManager.enableService`](conductor/api/services/ServiceManager.js) is called with a `projectId` (the usual app flow).
- **Conductor self-calls** `http://127.0.0.1:<PORT>/api/services/secrets_manager/...` using the **conductor service token** (`getConductorServiceToken`). In Docker, if `127.0.0.1` is wrong, set `CONDUCTOR_INTERNAL_BASE_URL` (e.g. `http://127.0.0.1:3000` or the conductor’s container URL) on the conductor process.
- **After changing a secret** in the UI, **re-enable** (or restart) the dependent service so the container gets new env. Until then, the old value remains in the running process.

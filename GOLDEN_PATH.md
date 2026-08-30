# Golden path — minimal happy path

Single narrative for “does the spine work?”: **conductor → auth → worker → project → enable service → reach service through the conductor proxy.**

## Prerequisites

- Conductor API reachable (default `http://localhost:3000`).
- A user account (seeded `admin` / `admin` only when `ALLOW_DEFAULT_ADMIN_SEED=1`, or your test user).
- Worker repo configured with `CONDUCTOR_URL` and registration token; Docker available if you deploy service containers.

## 1. Get a JWT (never commit tokens)

```bash
export CONDUCTOR_URL="${CONDUCTOR_URL:-http://localhost:3000}"
export AUTH_TOKEN="$(curl -s -X POST "${CONDUCTOR_URL}/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")"
```

Use your real username/password if not using the default dev user.

## 2. Run the worker

From `worker/`:

```bash
cp .env_example .env   # or .env.local → .env
npm start
```

Confirm logs show registration with the conductor.

## 3. Orchestration smoke (automated)

From the repo root:

```bash
export AUTH_PASSWORD='yourpassword'   # or export AUTH_TOKEN='...'
./test-orchestration.sh
```

This walks projects, workers, assignments, service enable/disable, and related APIs using **`AUTH_TOKEN`** or **`AUTH_PASSWORD`** (see script header).

## 4. Manual checks (same spine)

| Step | Example |
|------|--------|
| Projects | `GET ${CONDUCTOR_URL}/api/projects` with `Authorization: Bearer $AUTH_TOKEN` |
| Workers | `GET ${CONDUCTOR_URL}/api/workers` |
| Assign worker to project | `POST ${CONDUCTOR_URL}/api/projects/{projectId}/workers/{workerId}` |
| List services | `GET ${CONDUCTOR_URL}/api/services` |
| Enable a service for a project | Use dashboard or `POST .../api/projects/{projectId}/services/{serviceId}/enable` |
| Service registry lookup | `GET ${CONDUCTOR_URL}/api/services/registry/{serviceName}` |

## 5. How service proxying works (mental model)

- Services **register** with `POST /api/services/register` (no user JWT).
- **All client and service-to-service HTTP** should go through the **conductor** so auth, request IDs, and logging stay centralized.
- **API pattern (any manager):** ` /api/services/:serviceName/api/...` → proxied to the worker deployment (JWT or service token + `project_id` / `X-Project-Id` as required). Path mapping: [`conductor/api/utils/buildServiceProxyPath.js`](conductor/api/utils/buildServiceProxyPath.js). Implementation: generic route in [`conductor/api/routes/services.js`](conductor/api/routes/services.js) + `ServiceManager.proxyServiceRequest`.
- **Exceptions (same file, registered first):**
  - **storage_manager** **signed** uploads/downloads: `/api/services/storage_manager/signed/...` (HMAC; no user JWT on that path).
  - **storage_manager** `api` routes use a dedicated handler (file streaming, signed-URL rewrites in JSON).
  - **db_manager** `api` routes use a dedicated handler (forwards the caller JWT, default `project_id` for dashboard users).
- **Health & metrics (any service):** `GET /api/services/:serviceName/health`, `GET /api/services/:serviceName/metrics` (where the worker exposes them).
- **`logs_manager` ingest:** single line `POST /api/services/logs_manager/api/v1/logs`; batch (outbox / sync) `POST /api/services/logs_manager/api/v1/logs/batch` with body `{ "project_id", "entries": [ { "level", "message", "source?", "context?" } ] }` (max 200 entries). Worker agent can buffer offline with **`LOG_SPOOL=1`**, **`LOG_SHIP_BEARER`** (JWT or a registered service token), **`LOG_SHIP_PROJECT_ID`**, optional **`LOG_OUTBOX_PATH`** / **`LOG_SHIP_INTERVAL_MS`** — see `worker/.env_example`.

Routing and load balancing: [`conductor/api/services/ServiceManager.js`](conductor/api/services/ServiceManager.js) (`proxyServiceRequest`, `LoadBalancer`).

- **Worker host ports** (see [`worker/MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md)) are for the worker process and Docker publishes; **do not** call them from clients when the conductor is available — use the URLs above.

## 7. Production-hardening APIs (same spine)

| Step | Example |
|------|--------|
| Backup job | `POST /api/services/backup_manager/api/v1/jobs` `{ project_id, source, resource, vault }` → bucket `aerekos-backups` |
| Restore | `POST /api/services/backup_manager/api/v1/jobs/:id/restore` |
| IaC status / hookup | `GET/POST /api/projects/:id/iac/status\|hookup` |
| Edge status / hookup | `GET/POST /api/projects/:id/edge/status\|hookup` (existing Cloudflare secrets only) |
| Host OS/Docker | `GET/POST /api/workers/:id/host/check` · `POST .../host/update` `{ target: os\|docker }` |
| GraphQL | `POST /api/services/graphql_manager/api/v1/execute` |
| Search | `POST /api/services/search_manager/api/v1/query` — real FTS hits |
| Email / SMS / Slack / push | Queue rows only (`outbound_disabled` / `queue_only`). Do not retry live send. |

## 6. Horizontal scale (many workers, one control plane)

The same **registration token** can provision **multiple machines**. Each time you start the worker (bare metal, VM, or a container with `CONDUCTOR_URL` + token), the conductor records a new **worker** row. To scale a project’s services:

1. **Register** as many workers as you need (one agent per host).
2. **Attach workers to a project** (`POST /api/projects/{id}/workers/{workerId}`) so deployments can target that pool.
3. **Enable services** and set **scaling** / replica counts — the orchestrator picks workers (resource-aware) and the **per-service** conductor proxy (see step 5 in §4) load-balances or routes traffic across instances that registered the right service.

You do *not* need a new conductor per node: **one conductor**, **N workers**, **M projects**; add capacity by adding worker containers to new hosts with the same token (or a newly minted one from Settings if you rotate).

## 7. E2E (full stack)

Scripted shell E2E: **conductor + worker + `key_manager` + `storage_manager` + `db_manager`**, then optionally the orchestration suite. See [`E2E.md`](E2E.md). From the repo root: `npm run e2e`.

## See also

- [`README.md`](README.md) — overview, architecture, install paths.
- [`E2E.md`](E2E.md) — full-stack E2E scripts and env vars.
- [`PRODUCTION.md`](PRODUCTION.md) — operator checklist for shared deployments.

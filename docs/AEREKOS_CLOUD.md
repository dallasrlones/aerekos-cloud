# aerekos-cloud — Agent Orientation

> **Living reference for AI agents working on aerekos-cloud.** Read this first, keep it
> updated as the system changes. Not a substitute for reading the code — but it tells you
> *where* to look and *what is actually true right now*. Last updated: 2026-09-19.

---

## 1. What this is

`aerekos-cloud` is a self-hosted "cloud in a box": one **control plane (the conductor)**
plus a fleet of microservices ("**managers**") that together provide project lifecycle,
auth/IAM, storage, git, compute, queues, tunnels, and AI agents (**Icarus**). Everything
runs in Docker on the conductor host. The public face is `cloud.aerekos.com` (web UI).

There is **no external cloud** — the "cloud" is this machine's Docker stack + its
domains. Git is self-hosted at `git.aerekos.com`.

---

## 2. Deployment topology (where things actually run)

| Host | What | Notes |
|------|------|-------|
| **aerekos-server** (`192.168.0.141`) — *this machine* | **conductor host = "prod-mini"** | Runs the conductor + ~34 managers + rabbitmq + redis + headscale + cloudflared + Icarus. 16 cores / 30 GB RAM / ~937 GB disk. **24 TB USB HDD at `/mnt/usb24tb`** (movies/TV; the media source for aerekos-tv). |
| **Dallass-MacBook-Air** (laptop) | where the *newer* source was copied from | 8 cores / 16 GB. `.worker-host.env` said `WORKER_HOSTNAME=Dallass-MacBook-Air.local`. |
| **orin.aerekos.com** | Jetson (GPU) | vLLM / heavy AI. Do **not** run vLLM on prod-mini. |
| **cloud.aerekos.com** | public web UI | login `admin` / `admin`. |
| **git.aerekos.com** | self-hosted git | the **git_manager** service, host port **3130**. |
| **tv.aerekos.com** | (planned) aerekos-tv | Task 7. |

SSH aliases used in docs: `prod.aerekos.com`, `dev.aerekos.com`, `orin.aerekos.com`.

---

## 3. Where the code lives (source of truth)

- **Canonical SoT tree (this machine):** `/home/aerekos/work/aerekos/aerekos-cloud`
  - Top dir is `root:root` — needs `sudo chown aerekos:aerekos <topdir>` before `git init` / adding top-level files.
  - **Running containers bind-mount this live** (conductor, worker, frontend), so edits here are seen by the stack (code only takes effect on service restart/redeploy).
- **Laptop copy:** `/home/aerekos/work/laptop-aerekos-cloud/aerekos-cloud` — newer on ~2200 files (the "intended" SoT per the owner).
- **Pre-merge backup:** `/home/aerekos/work/aerekos/aerekos-cloud.bak-20260919-034054.tar` — **plain tar, NOT gzip** (use `tar -tf`, not `-tzf`).
- **git origin (`git.aerekos.com`):** the git_manager repos volume is currently **EMPTY** — the first push makes this machine the origin.
- **Reconciliation done 2026-09-19:** laptop's newer files + this machine's complete impls merged into the canonical tree. ~910 zero-byte files (a copy artifact that had emptied both copies) were **recovered from the pre-merge backup (906 restored)**; the ~4 still-empty are brand-new `ai_manager` stubs.

**Lesson:** the on-disk tree can be a *skeleton* (filenames with no content). If a file
is 0 bytes, check the running container and the backup before assuming it's really empty.

---

## 4. The control plane: conductor

- In-container port **3000**, host-exposed on **3300**.
- Express app at `conductor/index.js`; API under `conductor/api/`.
- Top-level API routes (`conductor/api/routes/`): `project, services, serviceOrchestration,
  deployment, releases, fleet, gateway, iam, auth, token, audit, jobs, live, ops, search,
  setup, worker, edge`.
- **The conductor is the router**: `GET/POST /api/services/<name>/...` proxies to the named
  service. Services **self-register** with it at boot.
- DB: `conductor/data/conductor.db` (SQLite via aerekos-record). Holds projects, services,
  service deployments, project↔service links, etc.
- **Frontend:** `conductor/app` (React) served by `aerekos-cloud-frontend` (runs
  `node web-proxy.js`; host ports 19006 / 38400 / 38401).
- `aerekos-cloud-worker` (host 3401) bind-mounts `worker/` and runs the worker-side entry.
- `aerekos-updater` bind-mounts the whole tree (self-update tooling).

---

## 5. How a "manager" works (the shared pattern)

Every `worker/<service>` is the same shape:

```
index.js
  └─ createManagerApp({ serviceName, defaultPort, db, register, ensureDefaults, extraSetup })
       from ../shared/managerBootstrap.js
       ├─ boots Express + /health + CORS + Prometheus metrics
       ├─ register   = makeRegister({serviceName, defaultPort, capabilities})
       │                from ../shared/serviceRegistration.js  → self-registers with conductor
       ├─ ensureDefaults(projectId)  → seeds per-project defaults on first touch
       └─ extraSetup(expressApp)     → mounts the service's /api/v1 router
```

- **DB layer: `aerekos-record`** (`services/aerekos-record`, also mirrored under
  `worker/services/` and `conductor/api/services/`). It is a **SQLite-backed ORM-like
  adapter** — `db.model(name, {cols}, {options})`, `model.create/find/update/...`. It is
  *not* Postgres. Composite uniques are awkward (the adapter makes single-column uniques),
  so uniqueness is enforced in the service layer.
- **Generic CRUD:** `worker/shared/crudBase.js` + `crudCore.js` (a `CrudService` base class).
- **Inter-service calls** go through the **conductor proxy**:
  `worker/shared/conductorProxy.js` → `conductorBase()`, `authHeaders(projectId)`, `skipFlag(...)`.
- **Per-service data** lives in a Docker volume `aerekos-cloud_<name>-data` (host path
  `/var/lib/docker/volumes/aerekos-cloud_<name>-data/_data/`).
- **Skip/fake flags** (`SKIP_*`) let services run in a degraded "fake" mode in dev;
  `worker/shared/prodGuards.js` (`assertNoSkipFakes`) enforces they're off in prod.

**To add a manager:** create `worker/<name>/` with `index.js` (the pattern above), an
`api/{models,routes,services,utils}`, a `package.json`, and a `Dockerfile`; register it in
the compose files; the conductor picks it up via self-registration.

---

## 6. Service inventory (name — host port — running? — purpose)

> Port = host-exposed. "in-c" = in-container default. "—" = not currently deployed.
> 58 services total (57 managers + conductor). **34 running, 23 not.**

**Core platform**

| Service | Port | State | Purpose |
|---------|------|-------|---------|
| **conductor** | 3300 (→3000) | RUNNING | control plane / router / registry |
| **frontend** | 19006 | RUNNING | web UI (React + web-proxy) |
| **worker** | 3401 (→3001) | RUNNING | worker-side host entry |
| rabbitmq | 5672 (+15672 mgmt) | RUNNING | message broker |
| redis | 6379 | RUNNING | cache / queues |
| headscale | 8080 (LAN) / 9090 | RUNNING | WireGuard mesh (tailscale-compatible) |
| cloudflared / aerekos_tunnel | — | RUNNING | egress tunnels / public exposure |

**Managers (running)**

| Service | Port | Purpose |
|---------|------|---------|
| compute_manager | 3100 | run workloads / containers |
| schedule_manager | 3102 | cron / scheduled jobs |
| network_manager | 3103 | networking |
| logs_manager | 3104 | logs |
| metrics_manager | 3105 | metrics |
| iam_manager | 3106 | identities & access |
| secrets_manager | 3107 | secrets |
| security_manager | 3108 | security policy |
| tunnel_manager | 3110 | tunnels |
| domain_manager | 3111 | DNS / domains |
| webhook_manager | 3112 | webhooks |
| auth_manager | 3116 | auth (tokens/sessions) |
| mcp_manager | 3123 | Model Context Protocol |
| host_manager | 3122 | host inventory |
| cicd_manager | 3119 | CI/CD |
| code_as_infra | 3120 | infra-as-code (see Task 5) |
| api_manager | 3124 | API management |
| system_manager | 3127 | system ops |
| worker_manager | 3128 | worker fleet |
| registry_manager | 3129 | container registry |
| git_manager | 3130 | **git.aerekos.com** (see §8) |
| event_manager | 3132 | event bus |
| config_manager | 3136 | config / flags |
| cert_manager | 3137 | certs / TLS |
| function_manager | 3139 | functions / lambda |
| graphql_manager | 3141 | GraphQL |
| trace_manager | 3143 | tracing |
| search_manager | 3144 | search |
| audit_manager | 3149 | audit log |
| status_manager | 3150 | status / health |
| storage_manager | 3003 | **storage** (see §7) |
| storage_admin / hosting / management | 3002 / 3001 / 3010 | storage sub-services (`services/{admin,hosting,management}`) |
| db_manager | 3004 | multi-DB (postgres, redis, mongodb, neo4j, elasticsearch, lancedb, sqlite) |
| key_manager | 3002 (int) | keys (encrypts storage files) |

**Managers (NOT running — code present, no container)**
`ai_manager, analytics_manager, app_manager, backup_manager, balancer_manager, billing_manager,
cdn_manager, cluster_manager, crawler_manager, download_manager, email_manager, iot_manager,
notebook_manager, push_manager, query_manager, slack_manager, sms_manager, transfer_manager,
vector_manager, vpn_manager, waf_manager, websocket_manager, workflow_manager`

**AI (Icarus) — deployed as `aer-cmp-*` containers, not the ai_manager service**

| Container | Port | Purpose |
|-----------|------|---------|
| aer-cmp-…-icarus-api | 4000 | Icarus API |
| aer-cmp-…-icarus-assistant | 4200 | Icarus assistant |
| aer-cmp-…-icarus-web | 8081 | Icarus web (nginx) |

**Demo project:** `dating-app-1` (6000), `dating-api-1` (6006).

---

## 7. Storage model (storage_manager)

- Models (`api/models/index.js`): **Project → Bucket → File (→ FileChunk)**, plus
  `SignedUrl` and `FileAccess` (audit).
- **Bucket `belongsTo` Project** (`project_id` FK) — *this is what Task 2 changes* to
  allow buckets to belong to a **System** (not just a Project) and to pin a bucket to a
  **physical path** (e.g. `/mnt/usb24tb/media`).
- Files are **encrypted** (key name from key_manager), support **chunked upload**, and
  **signed URLs**. Physical location = `storage_path` (currently under the service data
  volume — a 24 TB media bucket needs to live on the USB HDD instead).
- Sub-containers: `storage_admin` (3002), `storage_hosting` (3001), `storage_management` (3010).

---

## 8. Git (git.aerekos.com)

- `git_manager` service, host port **3130**. Routes: `repos, gitHttp, issues, pulls, checks`
  (it already has GitHub-style **issues/PRs** routes).
- Bare repos in volume `aerekos-cloud_git_manager-data/_data/repos/` — **currently EMPTY**.
- **Task 4:** make it look/feel like GitHub **plus** a full **Adonis** IDE (terminal,
  docker, container-manager integration) — "aerekos git manager with our IDE Adonis."

---

## 9. AI / Icarus

- `ai_manager` service holds the agent code but is **not running as a container**; the live
  Icarus runs as `aer-cmp-*` containers (§6).
- New `ai_manager` files — `ContextPack.js`, `ComputerJail.js`, `FriendMemory.js` (+
  `tests/unit/smart.test.js`) — are **0-byte stubs** (work in progress on the laptop).

---

## 10. Infrastructure

- Top-level `docker-compose.yml` + `docker-compose.core.yml` (and per-service files) define
  the stack. Key env: `HEADSCALE_*`, `CONDUCTOR_PROXY_TARGET`, `GIT_LAN_URL`,
  `PUBLIC_GIT_SHORT`, `WORKER_TOKEN`, `WORKER_REGISTRATION_TOKEN`, `APP_VERSION`.
- `.worker-host.env`: `WORKER_HOSTNAME=aerekos-server`, `WORKER_IP=192.168.0.141`.
- Media: **`/mnt/usb24tb`** (24 TB, ~18 TB free) — the physical home for the `media` bucket.

---

## 11. Known gaps / current state (as of 2026-09-19)

- **23 managers not deployed** (incl. `download_manager`, `ai_manager`).
- **download_manager:** HTTP download works; **real torrent (qBittorrent/aria2) and YouTube
  (yt-dlp) are stubbed** — `completeLive()` throws "requires a host downloader". Not deployed.
- **git origin not pushed** (repos volume empty).
- **Top-level dir is `root:root`** — `git init` blocked until chown.
- **aerekos-record** is a custom SQLite adapter, not Postgres — mind its uniqueness quirks.

---

## 12. Work in progress → see `~/work/work_todo.md`

Active: **1** (docs/SDK/API production-ready + UI recommendations), **2** (Download
Manager), **4** (Git Manager + Adonis IDE), **5** (Infra as Code JSON), **7** (aerekos-tv).
Parked (`//`): **3** (container manager/images), **6** (better service enabling).

**Ordering:** foundation (git origin) → 2 (download + system buckets + media) → 5 (IAC) →
4 (git/Adonis) → 7 (aerekos-tv, depends on 2) → 1 (docs finalized throughout).

---

## 13. Quick recipes

- **Hit the conductor:** `curl http://192.168.0.141:3300/api/...` (or via `cloud.aerekos.com`).
- **Call a service directly:** `curl http://192.168.0.141:<port>/api/v1/...` with the
  project auth headers (see `worker/shared/conductorProxy.js`).
- **See a service's live code:** `docker exec <container> cat /app/<service>/...`
  (workers live at `/app/<service>/`, plus `/app/shared/`).
- **Find a service's data on disk:** `/var/lib/docker/volumes/aerekos-cloud_<name>-data/_data/`.
- **Deploy a change:** edit the canonical tree, then rebuild/redeploy that one service
  (don't churn the whole running stack).

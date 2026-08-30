> **Internal planning document.** This is the active task queue and session log maintained by
> the project team. It is not part of the user-facing documentation. New users should start with
> the [README](README.md). Status here may be ahead of, or behind, what is actually merged —
> shipped behavior is documented in `README.md`, `GOLDEN_PATH.md`, and per-service READMEs.

# aerekos-cloud — status, context & task queue

**If this chat ends:** point the next session at **this file first**. Update the **Status snapshot**, check off **Current sprint / queue**, and **append a row to Session log** when you stop.

---

## Goal (what “done” looks like)

Self-hosted **conductor + workers + pluggable services** that feel like a **minimal private AWS**: control plane API, project-scoped deploys, KMS + object storage + DB control plane (`key_manager`, `storage_manager`, `db_manager`), then queues/schedules/compute, then **public edge** as you grow.

**Public edge (Cloudflare):** **`domain_manager`** = DNS (zones, subdomains for services and your containerized apps). **`tunnel_manager`** = `cloudflared` tunnels from edge → private origins. Ship them as a **pair**; keep API/tunnel tokens in **`secrets_manager`** (or `key_manager`)—never in git. See [`worker/domain_manager/plan.md`](worker/domain_manager/plan.md) and [`worker/tunnel_manager/plan.md`](worker/tunnel_manager/plan.md).

**ORM:** npm [`aerekos-record`](https://www.npmjs.com/package/aerekos-record). **Manager index:** [`worker/MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md) (all manager packages; shell generator: `node worker/scripts/scaffold-manager-services.mjs`; P4 CRUD batch: `node worker/scripts/generate-p4-sqlite-mvp.mjs`).

**Docs to lean on:** root `plan.md`, `new_service.md`, `backend_guidelines.md`, `testing_guidelines.md`, `DOCKER.md`, `TESTING.md`, per-package `plan.md` under `conductor/` and `worker/<service>/`.

---

## Yoda plan — 2026-04-23 “one spine, done beats perfect”

**Principle:** One **HTTP edge** (conductor), one **durable log sink** (`logs_manager`), everything else is **adapters** (outbox, shipper, small SDKs). Ship vertical slices, not Chapter 4 of `plan.md` in a day.

### Architecture decisions (locked for this track)

1. **System of record for log lines (when online):** `POST` → `logs_manager` **via conductor only** — `CONDUCTOR_URL/api/services/logs_manager/api/v1/...` with JWT or a **registered `service_token`** (same as generic proxy). Never require workers to know worker-host ports for managers when conductor is up.
2. **Offline / flaky network:** **SQLite outbox** on the worker (and optionally the same pattern in other long-lived processes), **batched** upload via `POST /api/v1/logs/batch` to avoid sync storms. **Idempotency** = future enhancement (`client_event_id` in `context` + optional unique index); v1 = delete-after-ack, duplicate risk on partial failure is acceptable for MVP if batches retry whole group.
3. **Auth for shipper:** Operator sets **`LOG_SHIP_BEARER`** (or `AEREKOS_LOG_BEARER`) — a **user JWT** or any **conductor-registered service token** the proxy accepts. **Not** the worker `CONDUCTOR_TOKEN` (registration) unless you explicitly issue it as a JWT; document clearly.
4. **Scope of “wire every service”:** **Pattern first:** shared **`worker/shared/logOutbox` + `LogShipper`** + worker agent opt-in is the reference. Full rollout = import `startLogShipping()` or call `enqueue` from each manager in a follow-up pass (scriptable: thin wrapper that logs to outbox + `console`).

### Today’s execution queue *(check in order; update Status snapshot as you go)*

- [x] **S1 — Plan** — this section + decisions (you are here).
- [x] **S2 — Ingest** — `logs_manager`: `POST /api/v1/logs/batch`, `LogEventService.createBatch`, Jest.
- [x] **S3 — Outbox** — `worker/shared/logOutbox` (WAL SQLite), `LogShipper` → conductor URL, unit tests.
- [x] **S4 — Worker** — `startLogShipping()` opt-in (`LOG_SPOOL=1` + `LOG_SHIP_BEARER` + `LOG_SHIP_PROJECT_ID`), `worker/.env_example`, `gracefulShutdown` stop.
- [ ] **S5 — Widen** — optional thin `worker/shared/emitServiceLog.js` (enqueue + console) + call sites in **1–2** hot paths (e.g. deployment error); or defer.
- [ ] **S6 — P5 / release** — `npm audit` triage, tag `v0.1.0`, CHANGELOG compare links (human; see §P5 F).
- [x] **S7 — Docs** — `GOLDEN_PATH.md` §5 logs/batch + env; Platform audit line updated (this file §Platform audit).

### Known non-goals (today / this sprint)

- Conductor **HA**, **mTLS**, **global log search** (elastic), full **OpenTelemetry** — not in this slice.
- **Idempotent server-side** dedupe of batched log lines — add when pain appears.
- Running **Jest in all 30 managers** in CI — still optional; root CI stays conductor + worker agent.

### Risk register

| Risk | Mitigation |
|------|------------|
| Wrong bearer 401 on shipper | Document `LOG_SHIP_BEARER`; log warn once, `bumpFailure` with backoff, drop after N attempts |
| Disk full on outbox | `MAX_ATTEMPTS` + drop; future: cap DB size / FIFO |
| Multi-project workers | outbox row carries `project_id`; shipper groups batches per project |

---

## Status snapshot *(update when you finish a chunk)*

| Area | State | Notes |
|------|--------|--------|
| Conductor + RN dashboard | Advanced | Key Manager: KMS + **service secrets** UI; **enable** of tunnel/domain **injects** `CLOUDFLARE_*` from project secrets; verify vs `plan.md` checkboxes |
| Worker agent | Advanced | Docker deploys, WebSocket, registration |
| `key_manager` / `storage_manager` / `db_manager` | Implemented + P1 docs/tests | Conductor proxy tests; shell E2E via `npm run e2e:docker` / `E2E.md` |
| Edge (Cloudflare) | **MVP in repo** | `domain_manager` (Cloudflare DNS records API) + `tunnel_manager` (cfd_tunnel create/delete; token only on create); pair conductor-seeded; `SKIP_CLOUDFLARE` for Jest |
| Manager service packages (30) | P2 + **P3 + P4** done for MVPs in repo | P4 = SQLite CRUD + Jest; **P5** OSS / next-hardening still open; live SMTP/Slack/LLM/CI = later + keys |
| Tests | **Conductor + worker agent Jest green** (see §Platform audit below) | Per-manager tests: `cd worker/<name> && npm test`; `db_manager` farm tests gated |
| OSS / GitHub | **In progress (P5)** | LICENSE, SECURITY, CONTRIBUTING, CoC, CHANGELOG, PRODUCTION, `.nvmrc`/`engines`, GitHub CI + issue/PR templates added; **tag `v0.1.0`** + compare URLs in CHANGELOG + branch protection = human follow-up |
| **Log pipeline (offline → conductor)** | **MVP in repo** | `POST /api/v1/logs/batch`; worker `shared/logOutbox` + `LogShipper`; opt-in `LOG_SPOOL` + `LOG_SHIP_BEARER` + `LOG_SHIP_PROJECT_ID`; **S5–S7** = widen emitters + doc sweep |

**Last updated:** 2026-04-23 *(Yoda plan + S2–S4: batch ingest, outbox/shipper, worker opt-in)*

---

## Current sprint — do in order *(P0 → P1 → P2)*

Work **top to bottom**. Check the box when truly done (code + tests where applicable).

### P0 — Platform spine (nothing else matters until this is solid)

1. [x] **Conductor service registry & routing** — `POST /register` refreshes config; `GET /api/services/registry/:serviceName`; proxy is **per-service** paths (`key_manager`, `storage_manager`, `db_manager` — see [`GOLDEN_PATH.md`](GOLDEN_PATH.md)). Optional: reconcile `conductor/plan.md` §11.9 “generic `:serviceName/*`” checkboxes vs this design.
2. [x] **Golden path doc + script** — [`GOLDEN_PATH.md`](GOLDEN_PATH.md) + existing [`test-orchestration.sh`](test-orchestration.sh) (`AUTH_TOKEN` / `AUTH_PASSWORD`).
3. [x] **Fix flaky / failing tests** — WebSocket: frontend-first connect, `worker:subscribe` for live room, longer timeouts, `this.io` guard on worker disconnect; worker: dockerode `getImage`/`pull` mocks, `inspect().Name` guard, `DeploymentHandler` call signatures.
4. [x] **Secret hygiene** — `QUICK_START.md` uses `$AUTH_TOKEN` + login example; `test-orchestration.sh` uses `AUTH_TOKEN` or `AUTH_PASSWORD`; repo grep clean for pasted JWT prefix.

### P1 — Core three services (make them “production-shaped”)

5. [x] **`storage_manager`** (E2E path) — ✅ Jest + `encryptionConductorPath`; **shell E2E:** [`E2E.md`](E2E.md) / `npm run e2e:core` enables all three core services and smoke-tests conductor proxy (including storage). **Optional:** tune `E2E_DEPLOY_STABILIZE` if pulls are slow.
6. [x] **`key_manager`** — Conductor: `tests/integration/keyManagerProxy.test.js` (JWT + service token → `proxyServiceRequest` path `/api/keys/:name`). **Docs:** `worker/key_manager/README.md` — “Operations: master key vs data key rotation”.
7. [x] **`db_manager`** — `BACKUP_RESTORE.md` + `START_HERE` link; **`npm test` green** in `worker/db_manager` (unit + `integration/api`); **`tests/integration/databases/*`** excluded from default Jest (use `npm run test:integration` with conductor + Docker). `DatabaseRepository.findAll` maps to aerekos `{ where: … }`; `EncryptionService` `MOCK_KEY_MANAGER` for tests.

### P2 — First real manager implementations *(template → product)*

Implement in this order (each: follow `worker/<name>/plan.md`, unit + integration + E2E checklist). **Edge pair (11–12)** matches the “subdomains + tunnels for my own AWS” story—do both before you expect public hostnames for containerized apps.

8. [x] **`queue_manager`** (3101) — SQS-like MVP: SQLite + aerekos-record, project-scoped queues, send/receive/delete, visibility / change-visibility; conductor seed; see `worker/queue_manager/README.md`.
9. [x] **`schedule_manager`** (3102) — SQLite + `node-cron`, webhook or `queue_manager` target, `POST …/run`; conductor seed; `worker/schedule_manager/README.md`.
10. [x] **`compute_manager`** (3100) — Task API: SQLite + dockerode, project-scoped tasks, create/list/get/stop/delete, `?refresh=1`, labels/`ServiceManager` naming family; `SKIP_DOCKER` tests; conductor seed. See `worker/compute_manager/README.md`.
11. [x] **`domain_manager`** (3111) — **Cloudflare DNS** via API v4: CRUD for records (per `zone_id` + `project_id`); `SKIP_CLOUDFLARE` in tests; [`plan`](worker/domain_manager/plan.md).
12. [x] **`tunnel_manager`** (3110) — **Cloudflare Tunnel** (`POST/DELETE` `…/accounts/{id}/cfd_tunnel`); one-time `token` + `credentials_file` on create only (not stored in DB); `SKIP_CLOUDFLARE` in tests; [`plan`](worker/tunnel_manager/plan.md).
13. [x] **`secrets_manager`** (3107) — SQLite `StoredSecret`; AES-256-GCM envelope via `SecretCrypto` + `key_manager` (or `MOCK_KEY_MANAGER`); REST `/api/v1/secrets*`; list never returns value; `?reveal=1` for plaintext; conductor seed.
14. [x] **`iam_manager`** (3106) — SQLite `IamRole` / `IamPolicy` / `IamRolePolicyBinding`; REST `/api/v1/roles*`, `/api/v1/policies*`, attach/detach; policy `document` as JSON; **enforcement** remains in conductor (this store is authZ data). Conductor seed.

### P3 — Ops, observability, registry

15. [x] **`logs_manager`** (3104) — SQLite `LogEvent` (append-only); `POST/GET /api/v1/logs`, `GET …/:id`; levels `debug|info|warn|error|fatal`; optional `context` JSON; query `level`, `since` (ISO), `limit` (max 1000); `GET /metrics`; conductor seed.
16. [x] **`GET /metrics`** (Prometheus text) — `conductor/api/utils/simplePrometheusMetrics.js` + `worker/shared/simplePrometheusMetrics.js`: `aerekos_<service>_http_requests_total` counter; **conductor**, **worker agent**, **`key_manager`**, **`storage_manager`**, **`db_manager`**. **Optional later:** `metrics_manager` (3105) for aggregation. Tests: `conductor/tests/integration/metrics.test.js`, `worker/tests/simplePrometheusMetrics.test.js`.
17. [x] **`registry_manager`** (3129) — [`REGISTRY.md`](worker/registry_manager/REGISTRY.md) (Harbor vs `registry:2` vs Docker Hub); `GET /api/v1/registry/config` (env-driven, **no** secrets); worker pulls via `ServiceManager` + conductor `docker_image` — see `worker/docker/ServiceManager.js`; `GET /metrics`; conductor seed.
18. [x] **`network_manager`** (3103) — Per-project Docker bridge networks MVP: `ProjectNetwork` in SQLite, stable `aerekosn_<hash>` Docker name, `POST/GET/DELETE /api/v1/networks`, `SKIP_DOCKER` for Jest; conductor seed **3103**.

### P4 — Manager MVPs (SQLite, no live provider keys) ✅

**Done:** all P4 services have `GET/POST/DELETE` CRUD on project-scoped entities + `/health`/`/ready`/`/api/v1/info` active + Jest. **`webhook_manager`**: real outbound `POST` unless **`SKIP_OUTBOUND=1`**. Conductor `seedServices` + `ensureMissingDefaultServices` include these ports. Regenerator: `node worker/scripts/generate-p4-sqlite-mvp.mjs` (re-applies the generic pattern—review diffs). **Still needs real keys or prod wiring:** SMTP/Twilio/Slack sends, LLM calls, CI runners, OS exec, real crawls, OIDC with client_secret, cloud LBs, etc.

19. [x] **Integrations & comms** — `webhook_manager` (outbound; `SKIP_OUTBOUND`), `email_manager` / `sms_manager` / `slack_manager` (message rows; add providers later), `balancer_manager`, `security_manager` (all SQLite CRUD).
20. [x] **Product-shaped templates** — `api_manager` (`/endpoints`), `app_manager`, `ai_manager` (config store), `cicd_manager`, `code_as_infra`, `crawler_manager`, `mcp_manager`, `analytics_manager`, `cdn_manager`, `auth_manager` (metadata only—secrets via `secrets_manager`), `host_manager`, `worker_manager`, `system_manager` (no exec), `metrics_manager` (metric samples; not aggregation cluster).

### P5 — Open source & release

21. [ ] **Phase A–F** (see below) — LICENSE, SECURITY.md, CONTRIBUTING, `.github/workflows`, README polish, `CHANGELOG.md`, tag `v0.1.0` when ready.

---

## Test commands *(quick ref)*

```bash
# Root workspaces
npm test
npm run test:conductor
npm run test:worker

# One manager package (after npm install in that folder)
cd worker/queue_manager && npm install && npm test
```

---

## OSS checklist (Phases A–F) — *parallel when prepping GitHub*

**A — Legal & community:** [x] LICENSE, SECURITY.md, CODE_OF_CONDUCT.md, CONTRIBUTING.md, issue/PR templates.

**B — Hygiene:** token audit, `.gitignore` hardening, `npm audit` notes.

**C — CI:** [x] `.github/workflows/ci.yml` — `npm ci`, `test:conductor`, `test:worker` on push/PR to `main` / `master` / `develop`.

**D — Docs:** [x] README — Security, Production, Contributing, License; roadmap still `plan.md` / `todo.md`.

**E — Ops:** [x] `PRODUCTION.md` checklist (TLS, secrets, metrics, hardening); threat model = tighten per environment.

**F — Release:** [ ] tag `v0.1.0`, [x] `CHANGELOG.md` Unreleased, [ ] repo topics & branch protection (manual).

### Production readiness tracker *(visible at-a-glance)*

| Item | Status |
|------|--------|
| `LICENSE` (MIT) | done |
| `SECURITY.md` | done |
| `CONTRIBUTING.md` + `CODE_OF_CONDUCT.md` | done |
| `CHANGELOG.md` | done (add compare links when `v0.1.0` exists) |
| `PRODUCTION.md` | done |
| `.nvmrc` + `package.json` `engines` | done |
| `.github/workflows/ci.yml` | done |
| Issue + PR templates | done |
| README — Security, Production, License, links | done |
| Git tag + branch protection + `npm audit` | open (human) |
| Secret → container env for edge services | [x] conductor `projectSecretEnv` + `ServiceManager` + port map; see `PRODUCTION.md` |

### Production / deploy follow-ups *(checklist)*

- [x] **Unique manager ports** — single source [`conductor/api/config/managerServicePorts.js`](conductor/api/config/managerServicePorts.js) aligned with [`worker/MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md) + seed; conductor `enableService` uses full map.
- [x] **Inject project secrets** into `tunnel_manager` / `domain_manager` containers at enable time (`CLOUDFLARE_*` from named secrets in `projectSecretEnv.js`).
- [ ] **After secret change** — re-enable or restart service (or add automated restart later).
- [ ] **Docker** — set `CONDUCTOR_INTERNAL_BASE_URL` on conductor if it cannot call `http://127.0.0.1:<PORT>`.
- [ ] **Release hygiene** — tag, branch protection, `npm audit` (see P5 F).

---

## Repo map

| Area | Path |
|------|------|
| Control plane + dashboard | `conductor/` |
| Worker agent + services | `worker/` |
| Manager index + ports | `worker/MANAGER_SERVICES.md` |
| Service generator | `worker/scripts/scaffold-manager-services.mjs` + `manager-services-manifest.json` |
| ORM | npm `aerekos-record`; root `better-sqlite3` for workspace hoisting |

---

## Platform audit *(2026-04-24)*

**Verified**

- **Conductor** `npm test` (under `conductor/`): **10**+ suites, **130**+ tests passing (includes secret-env unit + proxies).
- **Worker agent** `npm test` (under `worker/`, agent + unit + integration): **8** suites, **125** tests passing (mock conductor on **port 31900** by default — not 3000/3002 — so local dev stacks don’t hijack integration tests).
- **`worker/tests/integration/worker.test.js`** updated for `ConductorService.registerWorker(token, hostname, ip, resources, …)`; **`mockConductor.js`** accepts `hostname` / `ip_address` / `worker_id` and only reuses `worker_id` when that worker already exists (unknown id → new worker).
- **`conductor/scripts/seedServices.js`** — `seedServices` + `ensureMissingDefaultServices` include **all** manager names/ports aligned with [`MANAGER_SERVICES.md`](worker/MANAGER_SERVICES.md).

**Gaps / follow-ups** *(not blockers for local dev)*

- **Conductor HTTP proxy:** **generic** `GET/POST/… /api/services/:serviceName/api/…` for registered managers (see [`GOLDEN_PATH.md`](GOLDEN_PATH.md) §5); **exceptions** (storage stream, db JWT forward, etc.) unchanged. `logs_manager` is reachable as `/api/services/logs_manager/api/v1/…` (including **`POST …/logs/batch`** for outbox shipper).
- **Root `npm test`** runs **workspace packages** (`conductor/`, `worker/` agent only). It does **not** run all **`worker/*_manager`** Jest projects; validate a manager with `cd worker/<name> && npm install && npm test`.
- **E2E** (`E2E.md`, `npm run e2e*`) does not necessarily spin every P4 service — use per-service `tests/e2e/README.md` before release.
- **Worker** Jest may log **`console.error`** from resource detector mocks and report **force exit** / open handles — known noise; use `--detectOpenHandles` if chasing leaks.
- **Product:** attach **`network_manager`** networks from **`ServiceManager`** (orchestrator) — see `network_manager/plan.md`.
- **P5** OSS/CI/PRODUCTION docs landed; **release** (tag, branch protection, audit triage) still human follow-up.

## Known debt *(don’t forget)*

- Root `plan.md` “Next Steps” / checkboxes may be **stale** vs git — reconcile when touching conductor.
- Old docs may still say “vendored aerekos-record” — prefer `backend_guidelines.md` + npm.
- **E2E:** each service folder has `tests/e2e/README.md` checklists — run per release for services you ship.
- **Scale-out (future product):** optional **worker pool labels / regions** (conductor filters deploy targets) — not required for MVP; see `GOLDEN_PATH.md` §6 for current “many workers, one token” model.

---

## Workspace note: `better-sqlite3`

npm workspaces can hoist `aerekos-record` to repo root; **root `package.json`** lists `better-sqlite3` so SQLite resolves. Conductor still declares its own `better-sqlite3`.

---

## Session log *(append only — one row per meaningful stop)*

| Date | What changed / what’s next |
|------|----------------------------|
| 2026-04-04 | Initial `todo.md`; OSS phases; local AWS notes; aerekos-record npm migration; manager scaffolds (30) + `MANAGER_SERVICES.md`. |
| 2026-04-04 | **This rewrite:** single prioritized P0–P5 queue, status snapshot, resume instructions, condensed OSS, known debt. **Next human/AI session:** start **P0 item 1** (verify/implement conductor service registry & routing vs code), then item 2 (golden path doc). |
| 2026-04-04 | P0 progress: JWT scrub (`QUICK_START`, `test-orchestration.sh`); `services.js` register merge + `GET …/registry/:serviceName`; `WorkerSocketService` disconnect guard; websocket tests + worker unit tests green for touched files. **Next:** P0 #1 proxy/plan reconcile, #2 golden path doc/script. |
| 2026-04-04 | `GOLDEN_PATH.md` added; P0 #1/#2 marked done in `todo.md` (per-service proxy documented). **storage_manager** docs: host drive detection + speed requirement in `plan.md` / `README.md` / `AGENT_PROMPT.md`; root `plan.md` roadmap line. |
| 2026-04-05 | **Test triage:** `ProjectWorker` / `ProjectService` / `ServiceDeployment` / `Resource` use explicit FK columns (aerekos-record multi-`belongsTo` bug). `ServiceManager.enableService` resolves `service` before `findOptimalWorkers`. Full conductor + worker Jest green. **Next:** P1 storage/key/db hardening. **Note:** delete or migrate old `conductor.db` if it still has mangled FK column names. |
| 2026-04-05 | **storage_manager P1 (partial):** `encryptBuffer` layout fixed to match `decryptBuffer`; chunk upload passes `bucket.project_id`; `MOCK_KEY_MANAGER` implementation + prod guard; startup/ready skip key_manager probe when mock; `SignedUrlService`/`StorageService`/`EncryptionService` unit tests updated. **Note:** `encryptBuffer` wire format change — re-upload any dev data encrypted with the old IV+tag+ciphertext order. Some storage_manager suites still fail pre-existing (`fs` mock vs `dbClient`, bad integration paths). |
| 2026-04-24 | **Stability + P1 path:** Conductor `websocket.test.js` — failure timers `clearTimeout` on success (fixes spurious `Test timeout` / double-`done()`); `jest.config` `forceExit` after socket.io. **storage_manager:** new `tests/integration/encryptionConductorPath.test.js` (conductor key_manager proxy contract). **Docs:** `GOLDEN_PATH.md` §6 horizontal scale (many workers, one control plane). **Next:** P1 #6 `key_manager` (conductor tests + key rotation doc), #7 `db_manager` backup story; optional docker-compose E2E for #5. |
| 2026-04-24 | **P1 key_manager + db_manager:** `keyManagerProxy.test.js`; key_manager README ops; **`db_manager`:** `BACKUP_RESTORE` / `START_HERE`; **48 green tests** (unit + `integration/api`); gated **`tests/integration/databases/`** (`DB_MANAGER_INTEGRATION=1` + `npm run test:integration`); `DatabaseRepository.findAll` `{ where }` fix; `EncryptionService` mock key path. |
| 2026-04-24 | **E2E:** [`E2E.md`](E2E.md) + `scripts/e2e-helpers.sh`, `e2e-full-stack.sh`, `e2e-everything.sh`; root `npm run e2e` / `e2e:core` / `e2e:orchestration`; `GOLDEN_PATH` §7; `test-orchestration.sh` `SKIP_DISABLE=1`. **Requires** live conductor + worker + Docker for service containers. |
| 2026-04-24 | **Edge strategy:** `domain_manager` + `tunnel_manager` documented as a **Cloudflare pair** (DNS + cloudflared); `MANAGER_SERVICES.md` + P2 reordered; `todo` goal paragraph; removed duplicate `domain_manager` from P4 scaffolds list. |
| 2026-04-25 | **P2 `queue_manager` MVP:** SQLite (`aerekos-record`), `Queue`/`Message` models, REST API (create/list/get/delete queue, send/receive/ack, visibility), `README`, conductor `seedServices` + `ensureMissingDefaultServices`, integration tests. |
| 2026-04-25 | **P2 `schedule_manager` MVP:** `Schedule` model, `node-cron` + `DispatchService` (axios → webhook or `queue_manager`), CRUD, `POST /schedules/:id/run`, `SKIP_CRON` for Jest, conductor seed port 3102. |
| 2026-04-25 | **P2 `compute_manager` MVP:** `Task` model, `DockerService`/`TaskService` (dockerode, image local check, port maps), CRUD + stop, `SKIP_DOCKER` Jest, conductor seed (first in seed list) port 3100. |
| 2026-04-25 | **P2 edge pair:** **`domain_manager`** — SQLite + `DnsRecord`, `CloudflareDnsClient` + `DnsRecordService`, REST `/api/v1/dns/records*`, `SKIP_CLOUDFLARE` Jest, conductor seed **3111**. **`tunnel_manager`** — `Tunnel` + `CloudflareTunnelClient` + `TunnelService` (no token persistence; composite-unique via app-level check; `indexes` not broken `unique` tuples), REST `/api/v1/tunnels*`, conductor seed **3110**. **Next:** P2 **#13** `secrets_manager` / **#14** `iam_manager`. |
| 2026-04-25 | **P2 `secrets_manager`:** `StoredSecret` model, `SecretCrypto` (same GCM envelope as storage_manager; `MOCK_KEY_MANAGER` in Jest), `SecretService` + routes (create/list/get/patch/delete; `reveal=1` for value), `/health`/`/ready` via SQLite, conductor seed **3107**. **Next:** P2 **#14** `iam_manager`. |
| 2026-04-25 | **P2 `iam_manager`:** `IamRole` / `IamPolicy` (effect allow/deny, JSON `document`) / `IamRolePolicyBinding`, `IamService` + routes under `/api/v1/roles` and `/policies`, nested attach/detach, conductor seed **3106**. Policy evaluation not centralized yet—**conductor** should consume this store for RBAC over time. **Next:** **P3** (logs/metrics/etc.). |
| 2026-04-26 | **P3 #16 (metrics path):** Hand-rolled **Prometheus text** `GET /metrics` (no `prom-client`—avoids broken `@opentelemetry` hoists). Counter `aerekos_<service>_http_requests_total{method,code}`; skips `/health`, `/ready`, `/metrics`. Wired: **conductor**, **worker agent**, **key_manager**, **storage_manager**, **db_manager**. Tests: conductor `metrics.test.js`, worker `simplePrometheusMetrics.test.js`. **Next:** P3 **#15** `logs_manager` (or repo-wide structured logging) / **#17** registry docs. |
| 2026-04-26 | **P3 #15 `logs_manager`:** `LogEvent` + `LogEventService` + routes; shared **`simplePrometheusMetrics`** on the service; conductor **`seedServices`** + **`ensureMissingDefaultServices`** port **3104**; Jest `logsApi` + health. **Next:** P3 **#17** registry / **#18** network, or wire services to `POST` logs. |
| 2026-04-26 | **P3 #17 `registry_manager`:** **`REGISTRY.md`**, `RegistryConfigService` + `GET /api/v1/registry/config`, `README` update, `simplePrometheusMetrics`, seed port **3129**, integration test. **Next:** P3 **#18** `network_manager`. |
| 2026-04-23 | **P3 #18 `network_manager` MVP:** `ProjectNetwork` + `ProjectNetworkService` (`DockerNetworkClient` / `dockerode`), REST under `/api/v1/networks`, `/health`/`/ready` + `simplePrometheusMetrics`, `SKIP_DOCKER=1` in Jest, `networksApi` integration tests, conductor **`seedServices`** + **`ensureMissingDefaultServices`** port **3103**. **Next:** P4 template services (**#19**) or wire workers to attach services to managed networks. |
| 2026-04-23 | **Docs sweep:** `worker/MANAGER_SERVICES.md` + `worker/README` + root `plan.md` §managers: distinguish **implemented** vs **template**; unimplemented services return JSON `status: "stub"`; README updates for `network_manager`, edge pair, IAM, logs, secrets; per-service `plan.md` “Phase 1” renamed to **Service layout**; `conductor/plan` §8.3 test “infrastructure” wording. Generator script name `scaffold-manager-services.mjs` unchanged. |
| 2026-04-24 | **P4 MVPs (no live API keys):** `webhook_manager` (outbound + `SKIP_OUTBOUND`); 18 P4 services via `generate-p4-sqlite-mvp.mjs` (per-project CRUD, SQLite, Jest, `/metrics` on each); `conductor/scripts/seedServices` + `ensureMissingDefaultServices` for all new ports. **Next:** wire real SMTP/Slack/Twilio, LLM, CI runners, or **P5** OSS. |
| 2026-04-23 | **P5 production prep:** `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `PRODUCTION.md`, `.nvmrc`, root `engines`, `.github/workflows/ci.yml` (conductor + worker tests), issue + PR templates; README links. **Next:** push to GitHub, confirm Actions green, then tag `v0.1.0`, branch protection, `npm audit` triage, CHANGELOG compare URLs. |
| 2026-04-24 | **Platform audit:** Conductor **124** + worker **125** Jest tests green; fixed **`worker/tests/integration/worker.test.js`** (`registerWorker` 5-arg, mock port **31900**); **`mockConductor.js`** hostname/ip + re-register only if `worker_id` exists. Docs: **`README.md`** Testing, **`TESTING.md`** status, **`GOLDEN_PATH.md`** §5 (proxy scope), **`worker/README`** test section, **`todo.md`** audit. **Next:** optional CI matrix for all `worker/*_manager` `npm test`; generic conductor proxy. |
| 2026-04-23 | **Yoda sprint (observability spine):** Added **`§ Yoda plan`** (decisions + queue). **`logs_manager`:** `POST /api/v1/logs/batch` + `createBatch`. **`worker`:** `shared/logOutbox` (SQLite WAL) + `LogShipper` → conductor; **`startLogShipping()`** with `LOG_SPOOL=1` + `LOG_SHIP_BEARER` + `LOG_SHIP_PROJECT_ID`; Jest `logOutbox.test.js`. **Next:** S5 optional `emitServiceLog` + 1–2 call sites, S6 P5 human, S7 `GOLDEN_PATH` + audit line. |
| 2026-04-23 | **Key Manager + secrets UI:** Conductor `POST/GET/DELETE` proxy for **`secrets_manager`** at `/api/services/secrets_manager/api/v1/*`; app screens `serviceSecretsList` / `createServiceSecret` / `serviceSecretDetails` under **Key Manager**; presets `cloudflare_api_token` + `cloudflare_account_id`. Removed one-off dev markdown: `worker/REVIEW_COMPLETE.md`, `FIXES_APPLIED.md`, `CODE_REVIEW_FIXES.md`, `KEY_MANAGER_REVIEW_SUMMARY.md`. **Note:** workers still read `CLOUDFLARE_API_TOKEN` from env — sync from stored secrets in your deploy pipeline. |
| 2026-04-23 | **Secret → container env at deploy:** `ServiceManager.enableService` calls `mergeProjectSecretsIntoConfig` (HTTP to conductor `secrets_manager` proxy) for **tunnel_manager** + **domain_manager** when `projectId` is set; maps `cloudflare_api_token` → `CLOUDFLARE_API_TOKEN`, etc. [`conductor/api/config/managerServicePorts.js`](conductor/api/config/managerServicePorts.js) = full per-service port map. **Next:** re-enable after secret edits; set `CONDUCTOR_INTERNAL_BASE_URL` in containerized conductor if needed. |

**When you resume:** set **Status snapshot** date, tick sprint boxes, add a session row with “stopped at P0-x” or similar.

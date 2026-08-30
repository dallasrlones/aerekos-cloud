# Enterprise standards — AWS/GCP-level bar

> **Status:** Accepted — apply to every manager plan  
> **Navigation:** [Index](./README.md) · [platform_app_access](./platform_app_access.md) · [aerekos_sdk](./aerekos_sdk.md)

This doc defines the **non-negotiable quality bar** for aerekos-cloud: same expectations users have of AWS and GCP — predictable APIs, least privilege, full CLI parity with the console, and production operability.

---

## Locked decisions (prior recommendations — all accepted)

| # | Decision | Implementation |
|---|----------|----------------|
| 1 | Unify auth middleware | `worker/shared/authManagerClient.js` everywhere; remove per-manager JWT fallbacks |
| 2 | Close direct-port bypass | `AUTH_REQUIRED=true` on all `:31xx` manager ports in prod compose |
| 3 | IAM + credentials | Human JWT → iam_manager policies; app JWT → credential `allowed_resources` + scopes |
| 4 | api_manager runtime gateway | Pretty invoke URLs; path → ARN routing |
| 5 | MOCK_KEY_MANAGER=false | Prod compose for storage_manager + secrets_manager |
| 6 | Bespoke console UIs | git, queue, webhook (and others) after app-access ships |
| 7 | Honest catalog status | Stubs marked `stub`; no false "implemented" for queue-only rows |
| 8 | Plans are the roadmap | `conductor/plan.md` COMPLETE = core only; production work lives here |
| 9 | Split-host documented | `SERVICE_DIRECT_HOSTS` + Orin LAN secrets in DEPLOYMENT.md |
| 10 | Edit generate-full-stack.mjs | Never hand-edit `docker-compose.full.yml` |
| 11 | Fleet VPC overlay | **Headscale** on prod; Tailscale sidecar on workers; ACL tags per project — [vpc_network.md](./vpc_network.md) |

---

## Deferred — third-party keys (do later)

Do **not** block app-access or core platform work on external providers. Keep CRUD/metadata; mark `needs-keys` in catalog.

| Manager | Provider | When |
|---------|----------|------|
| email_manager | SMTP / SES | When SMTP creds in secrets_manager |
| sms_manager | Twilio / SNS | When SMS provider keys available |
| slack_manager | Slack Web API | When bot token available |
| crawler_manager | HTTP egress | When crawl execution prioritized |

**Cloudflare edge (tunnel, domain, cdn):** not deferred — store `cloudflare.api_token` + `account_id` in secrets_manager; setup wizard probes live API. See [edge_stack_pro.md](./edge_stack_pro.md). `SKIP_CLOUDFLARE=1` for CI only.

**Until keys exist (email/sms/slack/crawler):** metadata CRUD + `SKIP_*` test modes stay; console shows "Connect provider" placeholder; CLI documents `--dry-run` / queue-only behavior.

---

## The three surfaces (every resource, every action)

Every user-facing capability must exist on **three surfaces** with identical semantics:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Click ops  │     │     CLI     │     │  SDK / API  │
│  (console)  │     │   aerekos   │     │  REST proxy │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┴───────────────────┘
                    same ARN, scopes, errors
```

### Parity matrix (required per manager)

| Action | Console | CLI | API |
|--------|---------|-----|-----|
| List resources | Table + filters | `aerekos {mgr} {seg} list --project` | `GET` + pagination |
| Create | Form wizard | `… create --data '{}'` | `POST` → 201 + ARN |
| Get / describe | Detail panel | `… get {id}` | `GET /:id` |
| Update | Edit form | `… update {id} --data '{}'` | `PATCH` |
| Delete | Confirm dialog | `… delete {id}` | `DELETE` |
| App access | Copy ARN + curl card | `aerekos cred create` + `invoke` | Documented in OpenAPI |
| Test / validate | "Test connection" button | `… test {id}` | `POST …/test` where applicable |

**Rule:** If a button exists in the console, a documented CLI command must exist before the manager is "production done."

Track parity in each manager plan under `## CLI & click ops parity`.

---

## API design standards (AWS/GCP-aligned)

### Uniform contract

All managers follow the same patterns (extend existing CRUD where possible):

```
POST   {proxyBase}/{resource}           → 201 { item, arn?, invoke_url? }
GET    {proxyBase}/{resource}           → 200 { items, next_cursor? }
GET    {proxyBase}/{resource}/:id       → 200 { item }
PATCH  {proxyBase}/{resource}/:id       → 200 { item }
DELETE {proxyBase}/{resource}/:id       → 200 { deleted: true }
POST   {proxyBase}/{resource}/:id/test  → 200 { ok, latency_ms?, error? }  (where applicable)
```

### Required behaviors

| Standard | Requirement |
|----------|-------------|
| **Versioning** | All paths under `/api/v1/`; breaking changes → `/api/v2/` + 6-month deprecation header |
| **Pagination** | Cursor-based: `?limit=50&cursor=` → `{ items, next_cursor }` on every list |
| **Idempotency** | `Idempotency-Key` header on POST creates (conductor or manager stores 24h) |
| **Request ID** | `X-Request-Id` echoed in response; generated if missing; in all logs |
| **Errors** | `{ error: { code, message, request_id, resource? } }` — same shape as AWS JSON errors |
| **Timestamps** | ISO 8601 UTC on all `created_at` / `updated_at` |
| **Tags** | Optional `tags: { key: value }` on creatable resources (billing/iam later) |
| **ARN** | Returned on create for app-access resources; immutable |
| **Scopes** | Documented in catalog `appScopes`; enforced on app JWT |
| **Project scope** | `project_id` query or path; reject cross-project access |

### Health probes (every manager)

| Endpoint | Purpose |
|----------|---------|
| `GET /health` | Liveness — process up |
| `GET /ready` | Readiness — DB migrated, deps reachable |
| `GET /metrics` | Prometheus text format |

---

## Security & compliance

| Practice | Standard |
|----------|----------|
| **Least privilege** | Credentials default to single-resource, single-scope; broaden explicitly |
| **Encryption at rest** | secrets_manager + storage_manager via key_manager (no plaintext on disk) |
| **Encryption in transit** | TLS at Cloudflare edge; LAN HTTP only where documented (Orin) |
| **Audit trail** | CloudTrail-equivalent: `logs_manager` or conductor audit table for mutating ops |
| **Secret reveal** | `?reveal=1` audit-logged; human JWT + iam policy required |
| **Credential rotation** | `POST /credentials/:id/rotate`; console + CLI; old secret invalidated immediately |
| **Rate limiting** | Per-IP login; per-credential invoke; per-project create |
| **Soft delete** | Critical resources (buckets, DBs, endpoints): `deleted_at` + 30-day recovery window |

---

## Observability (GCP Cloud Operations / AWS CloudWatch bar)

| Layer | Standard |
|-------|----------|
| **Structured logs** | JSON: `{ level, msg, request_id, project_id, resource_arn?, sub?, duration_ms }` |
| **RED metrics** | Rate, Errors, Duration per route on `/metrics` |
| **Tracing** | `trace_id` propagation (OpenTelemetry later; request_id now) |
| **SLOs** | Document per manager: availability target, p99 latency (in plan README) |
| **Alerting** | Prometheus rules: manager down >5m, error rate >1%, disk >85% |
| **Dashboards** | Grafana JSON templates per category (Core, AI, Compute) |

---

## Code quality gates

| Gate | Threshold |
|------|-----------|
| **Unit tests** | New services: ≥70% line coverage on `api/services/` |
| **Integration tests** | Every route: happy path + 401 + 403 (app scope) + 404 |
| **e2e** | Tier in `e2e/run.js` for each production-ready manager |
| **Lint** | ESLint clean on touched files |
| **Pre-commit** | Tests pass; no default secrets committed |
| **DRY** | Shared auth, ARN, pagination, error format in `worker/shared/` |
| **No silent fallbacks** | Auth failures return 401/403 — never "best-effort pass" in prod (`AUTH_REQUIRED=true`) |

### Service layer pattern (unchanged, enforced)

```
routes → services → repos/models
```

- Routes: parse, validate, call service, map errors to HTTP
- Services: business logic, ARN generation, scope checks
- No SQL in routes; no HTTP in services

---

## Documentation standards

| Artifact | Owner | Update trigger |
|----------|-------|----------------|
| `docs/catalog.js` | Source of truth for ports, endpoints, scopes, ARN namespace | Any API change |
| `docs/services/{mgr}.md` | Generated via `make docs` | Catalog change |
| `docs/plans/{mgr}.md` | Production checklist | Before/after major work |
| OpenAPI | `docs/openapi/{mgr}.yaml` — **new, generate from catalog** | Catalog change |
| Runbooks | `docs/runbooks/` — deploy, rotate-keys, incident | Operational change |
| ADRs | `docs/adr/` — architecture decisions | Non-obvious design choices |
| CLI help | `aerekos {mgr} --help` from catalog | Catalog change |

### Every app-access resource documents

1. ARN format  
2. Required scopes  
3. Token URL + invoke URL  
4. curl example (human admin)  
5. curl example (app credential)  
6. CLI: `aerekos cred create` + `aerekos invoke`  
7. Console path (click ops steps)

---

## CLI standards (`aerekos` + SDK)

Extend [aerekos_sdk.md](./aerekos_sdk.md):

| Command group | Commands |
|---------------|----------|
| **Auth** | `login`, `logout`, `whoami`, `token` (app client_credentials) |
| **Credentials** | `cred create`, `cred list`, `cred rotate`, `cred revoke` |
| **Invoke** | `invoke --service --resource arn:… --path --data` |
| **Managers** | `{manager} {resource} list|create|get|update|delete` (catalog-driven) |
| **Ops** | `services enable|disable`, `health`, `deploy status`, `e2e smoke` |
| **Config** | `config set url|project|token`; `~/.aerekos/config.json` mode 0600 |

**Output:** `--json` on every command for scripting (already started in CLI).

**Exit codes:** 0 success, 1 user error, 2 auth error, 3 upstream 5xx.

---

## Console (click ops) standards

| Pattern | Standard |
|---------|------------|
| **Layout** | AWS-style: left nav → list → detail → action bar |
| **ActionBar** | Primary ops as buttons (Create, Test, Copy ARN, Rotate, Delete) — not docs-first |
| **Empty states** | CTA to create + link to CLI equivalent |
| **App access card** | ARN, token URL, invoke URL, copy buttons, expandable curl |
| **Errors** | Toast + inline; show `request_id` for support |
| **Project context** | Global project picker; all screens respect `project_id` |
| **Loading** | Skeleton or spinner; no full-page flash |
| **Animus** | Themed panels/stats on dashboard managers (existing pattern) |
| **Global search** | AWS/GCP command palette — [global_search.md](./global_search.md) |
| **Setup wizard** | Per-service onboarding: what it does, deps, connected/configured status, guided setup — [service_setup_wizard.md](./service_setup_wizard.md) |

### Console build order (after app-access)

1. ai_manager (Endpoints + Credentials) — in progress  
2. git_manager (repos, branches, pushes)  
3. queue_manager (queues, messages, DLQ)  
4. webhook_manager (endpoints, delivery log)  
5. secrets_manager (dedicated screen beyond KeyManager)  
6. Generic ManagerConsole upgrade: App access tab when manager has `appScopes`

---

## New recommendations (AWS/GCP bar — add to plans)

Beyond prior list; **accepted** unless noted.

### Platform

- [ ] **E1** OpenAPI specs generated from `docs/catalog.js` → `docs/openapi/`
- [ ] **E2** Cursor pagination on every list endpoint (backfill existing managers)
- [ ] **E3** `Idempotency-Key` support on POST creates (conductor middleware)
- [ ] **E4** Uniform error envelope + `X-Request-Id` on conductor + all managers
- [ ] **E5** Conductor audit log API: `GET /api/audit?project_id=` (who/when/what/arn)
- [ ] **E6** Soft delete + recovery window for buckets, databases, AI endpoints
- [ ] **E7** Resource tagging (`tags` JSON) on creatable resources
- [ ] **E8** Per-project quotas (max endpoints, buckets, credentials) — enforce at create
- [ ] **E9** Usage metering hooks: increment counter per invoke (ARN + credential sub) for future billing
- [ ] **E10** `docs/runbooks/` — deploy, incident, key rotation, Orin recovery

### Reliability

- [ ] **E11** Conductor SQLite backup cron → storage_manager bucket
- [ ] **E12** db_manager scheduled backups (cron via schedule_manager)
- [ ] **E13** webhook_manager exponential backoff + DLQ (no external deps)
- [ ] **E14** queue_manager document at-least-once semantics + visibility timeout defaults
- [ ] **E15** Graceful degradation: manager down → conductor proxy 503 with retry-after

### Testing & CI

- [ ] **E16** Contract tests: OpenAPI examples vs supertest responses
- [ ] **E17** e2e Tier 6–7: app credential flows + CLI parity smoke
- [ ] **E18** Load smoke script per manager in `scripts/load/`
- [ ] **E19** PR gate: `make docs` + `e2e/run.js` Tier 1–4 required green

### Developer experience

- [ ] **E20** `aerekos completion bash|zsh` from catalog
- [ ] **E21** Interactive `aerekos wizard create-endpoint` for AI onboarding
- [ ] **E22** SDK TypeScript types generated from OpenAPI
- [ ] **E23** "Copy CLI command" on every console action (not only curl)
- [ ] **E24** Static docs site (`docs/site/`) includes CLI tab per service

### Security hardening

- [ ] **E25** Credential IP allowlist (optional per credential)
- [ ] **E26** Short-lived app tokens (default 1h; max 12h; refresh story documented)
- [ ] **E27** Break-glass admin role audited separately in iam_manager
- [ ] **E28** CORS policy documented for `cloudapi.aerekos.com` public API
- [ ] **E29** Security headers on conductor frontend (CSP, HSTS via Cloudflare)

### Catalog honesty

- [ ] **E30** Add `tier: production-ready | real-partial | stub | needs-keys` to every catalog entry
- [ ] **E31** P4 managers without provider: `status: stub` not `implemented`
- [ ] **E32** `cliParity: complete | partial | none` field per manager in catalog

### Additional (E33–E45) — accepted 2026-06-06

- [ ] **E33** Cross-tenant isolation test suite — project A cannot read/write project B (automated)
- [ ] **E34** Chaos tests — kill manager container → conductor 503 + recovery documented
- [ ] **E35** Versioned SQLite migrations for all managers (`migrations/` convention)
- [ ] **E36** Secrets scanning in CI (gitleaks/trufflehog on push)
- [ ] **E37** API deprecation policy doc + `Sunset` / `Deprecation` response headers
- [ ] **E38** Public status page for `cloud.aerekos.com` / `cloudapi` (or Cloudflare health check page)
- [ ] **E39** `make golden-path` — one command local dev matching prod auth patterns
- [ ] **E40** ai_manager LLM streaming (SSE) — console + CLI + API parity
- [ ] **E41** Inbound webhook signature verification (HMAC) on platform receivers
- [ ] **E42** Conductor DB + config backup/restore runbook tested quarterly
- [ ] **E43** Project-level user RBAC — users scoped to assigned projects (conductor)
- [ ] **E44** Immutable release tags — Docker images pinned by SHA in compose deploy
- [ ] **E45** SLO/error-budget panel on Dashboard (Animus stats from RED metrics)

### Post-MVP backlog (E46–E54) — after P0–P10, L1–L10, E1–E45, and CC items are done

Do not start these until the main production list is complete. Track as `post-e46` … `post-e54` in Cursor todos.

- [ ] **E46** Backup conductor HA — hot standby control plane (per root `plan.md`)
- [ ] **E47** `docs/adr/` — architecture decision records for non-obvious design choices
- [ ] **E48** SBOM + `npm audit` in CI — supply chain gate on deploy
- [ ] **E49** Slug validation middleware — `[a-z0-9][a-z0-9-_]{0,63}` on all resource names at create
- [ ] **E50** Conductor project membership — users belong to projects; no global admin by default (extends E43)
- [ ] **E51** Resource import/export — JSON bundle per project (DR / migration)
- [ ] **E52** Manager dependency graph — **superseded by** [service_setup_wizard.md](./service_setup_wizard.md) (per-service wizards + `GET /api/setup/graph`)
- [ ] **E53** LLM model governance — approved model allowlist per project (ai_manager)
- [ ] **E54** Compliance log export — audit + credential events → storage bucket on schedule (SOC2 prep)

---

## Operations pre-work (ops-pre) — before feature sprints

No code required; unblocks M1 and edge work.

- [ ] **ops-pre-1** Rotate prod `JWT_SECRET`, `AUTH_MANAGER_SECRET`, `MASTER_KEY`
- [ ] **ops-pre-2** Store `cloudflare.api_token` + `account_id` in secrets_manager
- [ ] **ops-pre-3** Runbook skeletons: `docs/runbooks/deploy.md`, `incident.md`, `key-rotation.md`
- [ ] **ops-pre-4** Catalog honesty E30–E31 before expanding console UI
- [ ] **ops-pre-5** Import manual cloud/cloudapi tunnels after pro-edge-1

---

## Release & fleet ([release_fleet.md](./release_fleet.md))

- [ ] **release-fleet-1** Publish pipeline + CI
- [ ] **release-fleet-2** Updater sidecar verified prod + Orin
- [ ] **release-fleet-3** agentAuth + audit
- [ ] **release-fleet-4** Version drift UI + rollback
- [ ] **release-fleet-5** Post-update e2e gate

---

## Project onboarding ([project_onboarding.md](./project_onboarding.md))

- [ ] **cc-project-1** Default VPC on project create
- [ ] **cc-project-2** Enable core stack toggle
- [ ] **cc-project-3** Dashboard setup %
- [ ] **cc-project-4** CLI `project create --enable-core`

---

## Fleet truth ([host_manager.md](./host_manager.md), [worker_manager.md](./worker_manager.md))

- [ ] **cc-fleet-1** host_manager sync from heartbeats
- [ ] **cc-fleet-2** worker_manager annotations sync
- [ ] **cc-fleet-3** DeviceDetails + Dashboard fleet health
- [ ] **cc-fleet-4** Register + Headscale preauth one flow

---

## Alert routing ([observability_alerts.md](./observability_alerts.md))

- [ ] **cc-alerts-1** AlertService rules (unhealthy >5m, heartbeat missing)
- [ ] **cc-alerts-2** webhook_manager delivery + runbook links
- [ ] **cc-alerts-3** Dashboard incident banner
- [ ] **cc-alerts-4** email/slack routes when defer-3p keys exist

---

## Milestone 1

First ship scope: [milestone_m1.md](./milestone_m1.md). Full registry: [MASTER_TODOS.md](./MASTER_TODOS.md).

---

## Definition of done (per manager)

A manager is **production done** when all are checked:

- [ ] App-access (if applicable): ARN, scopes, requireAuth, requireResource, e2e
- [ ] CLI parity: list/create/get/update/delete/test documented in `aerekos --help`
- [ ] Console: bespoke or ManagerConsole with App access card
- [ ] OpenAPI fragment in `docs/openapi/{mgr}.yaml`
- [ ] Integration tests: 401, 403 scope, happy path
- [ ] `/health`, `/ready`, `/metrics` verified
- [ ] Catalog updated (`tier`, `appScopes`, endpoints)
- [ ] Plan checkboxes in `docs/plans/{mgr}.md` complete
- [ ] Runbook entry if operator action required (keys, deploy, rotation)

---

## Links

- [README.md](./README.md) — walk order + cross-cutting checklist
- [platform_app_access.md](./platform_app_access.md) — ARN + credentials
- [aerekos_sdk.md](./aerekos_sdk.md) — CLI/SDK tasks
- [backend_guidelines.md](../../backend_guidelines.md)
- [testing_guidelines.md](../../testing_guidelines.md)

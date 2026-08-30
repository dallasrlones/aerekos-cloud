# Master todo registry

> **Canonical list** — every Cursor todo ID mapped here. Check boxes as work completes.  
> **Navigation:** [Index](./README.md) · [milestone_m1.md](./milestone_m1.md) · [enterprise_standards.md](./enterprise_standards.md)

**Progress (2026-06-07):** Platform P0–P10 code ✅ · Setup wizards cc-wizard-1–4 ✅ · pro-edge-0/1 code ✅ (prod CF secrets + cloudflared deploy = ops) · NOT production-complete — edge hostname wizard, VPC, enterprise bulk still open.

---

## How to use

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Pending |
| `[x]` | Done |
| **M1** | In [Milestone 1](./milestone_m1.md) ship scope |
| **DEFER** | [Deferred providers](./enterprise_standards.md#deferred--third-party-keys-do-later) |

Child plans hold implementation detail; this file is the **single checklist** for progress tracking.

---

## Milestone 1 (ship first)

See [milestone_m1.md](./milestone_m1.md). Finish **M1** before edge automation, Headscale, or full P6 rollout.

---

## Platform — app access (P0–P10)

Plan: [platform_app_access.md](./platform_app_access.md) · [conductor.md](./conductor.md) · [auth_manager.md](./auth_manager.md) · [ai_manager.md](./ai_manager.md)

| ID | Task | M1 |
|----|------|-----|
| p0-primitives | `worker/shared/arn.js`, `scope.js`, `requireResource.js`, catalog ARN metadata | **M1** |
| p1-credentials | auth_manager Credentials CRUD + dynamic token claims | **M1** |
| p2-conductor | Conductor `appProxyAuth` + token passthrough + `requireArnScope` | **M1** |
| p3-endpoints | AI Manager Endpoints + ARN generation | **M1** |
| p4-enforcement | AI Manager scope enforcement on inference routes | **M1** |
| p5-ui | AIManager UI — Endpoints, Credentials, App access card | **M1** |
| p6-rollout | App-access rollout: storage, db, secrets, compute, queue, webhook, git | ✅ |
| p7-iam | iam_manager policy evaluation at conductor edge | ✅ |
| p8-dx | SDK/CLI/docs/e2e — `getAppToken`, `invoke`, cred commands | **M1** partial ✅ |
| p9-api-manager | api_manager runtime gateway + pretty invoke URLs | ✅ |
| p10-hardening | AUTH_REQUIRED, unify auth, secrets, enablement UX | **M1** partial |

### P10 sub-items (platform_app_access Phase 10)

- [x] AUTH_REQUIRED wiring all gated managers in compose (flip on prod)
- [x] authManagerClient on app-access managers (key_manager legacy)
- [x] git_manager Smart HTTP via auth_manager Bearer
- [x] Rate limits: login + `/auth/token` (inference pending)
- [x] Audit: login success/failure + `GET /api/audit` (credential lifecycle pending)
- [ ] Rotate JWT_SECRET, AUTH_MANAGER_SECRET, MASTER_KEY in prod (ops-pre-1)
- [ ] MOCK_KEY_MANAGER=false storage + secrets (lock-5)
- [x] Per-project enablement UX (setup wizard + enable_core_stack)
- [x] e2e Tier 6 app credential scoped invoke (29/29)
- [x] SDK `getAppToken()`, `invoke()`
- [ ] Orin LAN HTTP docs (lock-9 partial in DEPLOYMENT)
- [ ] Direct-port `:31xx` auth audit doc

---

## Locked decisions (L1–L11)

Plan: [enterprise_standards.md](./enterprise_standards.md)

| ID | Task | M1 |
|----|------|-----|
| lock-1 | Unify auth — `authManagerClient.js` everywhere; remove JWT fallbacks | **M1** partial ✅ |
| lock-2 | AUTH_REQUIRED=true on all manager :31xx direct ports in prod compose | **M1** wired ✅ prod flip pending |
| lock-3 | IAM human JWT + credential app JWT dual auth model | |
| lock-4 | api_manager runtime gateway (path → ARN) | ✅ |
| lock-5 | MOCK_KEY_MANAGER=false in prod for storage + secrets | **M1** |
| lock-6 | Bespoke console UIs — git, queue, webhook after app-access | ✅ |
| lock-7 | Catalog honesty — stub/needs-keys tier, not false implemented | **M1** ✅ |
| lock-8 | Plans as production roadmap (conductor core ≠ production done) | |
| lock-9 | SERVICE_DIRECT_HOSTS + Orin LAN secrets in DEPLOYMENT.md | **M1** |
| lock-10 | Edit `generate-full-stack.mjs` only, not docker-compose.full.yml | |
| lock-11 | Fleet VPC = Headscale on prod + Tailscale sidecar + ACL per project | |

---

## Enterprise standards (E1–E45)

Plan: [enterprise_standards.md](./enterprise_standards.md)

| ID | Task | M1 |
|----|------|-----|
| e1 | OpenAPI specs from catalog → `docs/openapi/` | |
| e2 | Cursor pagination on every list endpoint | |
| e3 | Idempotency-Key on POST creates (conductor middleware) | |
| e4 | Uniform error envelope + X-Request-Id on all services | **M1** |
| e5 | Conductor audit log API `GET /api/audit` | partial ✅ |
| e6 | Soft delete + 30-day recovery (buckets, DBs, AI endpoints) | |
| e7 | Resource tagging (tags JSON) on creatable resources | |
| e8 | Per-project quotas enforced at create | |
| e9 | Usage metering hooks per invoke (ARN + credential sub) | |
| e10 | `docs/runbooks/` — deploy, incident, key rotation, Orin recovery | **M1** skeleton ✅ |
| e11 | Conductor SQLite backup cron → storage_manager bucket | |
| e12 | db_manager scheduled backups via schedule_manager | |
| e13 | webhook_manager exponential backoff + DLQ | |
| e14 | queue_manager at-least-once semantics + visibility defaults documented | |
| e15 | Manager down → conductor 503 with Retry-After | |
| e16 | Contract tests — OpenAPI examples vs supertest | |
| e17 | e2e Tier 6–7 app credentials + CLI parity smoke | ✅ |
| e18 | Load smoke scripts per manager in `scripts/load/` | |
| e19 | PR gate — `make docs` + e2e Tier 1–4 green | **M1** partial (`make docs` in CI) |
| e20 | `aerekos completion` bash\|zsh from catalog | |
| e21 | `aerekos wizard create-endpoint` interactive AI onboarding | |
| e22 | SDK TypeScript types generated from OpenAPI | |
| e23 | Copy CLI command on every console action bar | |
| e24 | docs/site/ CLI tab per service | |
| e25 | Credential IP allowlist (optional per credential) | |
| e26 | Short-lived app tokens (1h default, max 12h, refresh docs) | |
| e27 | Break-glass admin role separately audited in iam_manager | |
| e28 | CORS policy documented for cloudapi.aerekos.com | |
| e29 | Security headers on frontend (CSP, HSTS via Cloudflare) | |
| e30 | catalog `tier` field per manager | **M1** |
| e31 | P4 stubs marked `status: stub` not implemented in catalog | **M1** |
| e32 | catalog `cliParity` field per manager | |
| e33 | Cross-tenant isolation automated test suite | |
| e34 | Chaos tests — manager container kill → 503 + recovery | |
| e35 | Versioned SQLite migrations convention for all managers | |
| e36 | Secrets scanning in CI (gitleaks/trufflehog) | |
| e37 | API deprecation policy + Sunset response headers | |
| e38 | Public status page for cloud.aerekos.com / cloudapi | |
| e39 | `make golden-path` — one-command local dev matching prod auth | |
| e40 | ai_manager LLM streaming SSE — console + CLI + API | |
| e41 | Inbound webhook HMAC signature verification | |
| e42 | Backup/restore runbook tested quarterly | |
| e43 | Project-scoped user RBAC on conductor | |
| e44 | Immutable deploy — Docker image SHA pinning in compose | |
| e45 | SLO/error-budget panel on Dashboard (RED metrics) | |

---

## Cross-cutting (CC)

Plan: [enterprise_standards.md](./enterprise_standards.md) · [conductor.md](./conductor.md)

| ID | Task |
|----|------|
| cc-three-surface | Three-surface rule — every console action has CLI + API |
| cc-health-dash | Health aggregation dashboard for all enabled managers |
| cc-prometheus | Prometheus scrape all managers + alert unhealthy >5m |
| cc-logs-retention | logs_manager retention + compaction |
| cc-storage-multipart | storage_manager multipart upload resume → [storage_manager.md](./storage_manager.md) pro-storage-10 |
| cc-worker-fleet | worker.md — Orin post-deploy smoke + AUTH_REQUIRED in worker compose |
| cc-console-standards | ActionBar, empty states, request_id in errors, project picker |
| cc-obs-red | Structured JSON logs + RED metrics per route |
| cc-obs-grafana | Grafana dashboard templates (Core, AI, Compute) |
| cc-obs-otel | OpenTelemetry tracing (trace_id after request_id) |
| cc-def-done | Definition-of-done checklist enforced per manager |

---

## Global search (cc-search)

Plan: [global_search.md](./global_search.md)

| ID | Task | M1 |
|----|------|-----|
| cc-search-1 | Clickable header + CommandPalette + ⌘K/Ctrl+K (fix `editable=false`) | **M1** ✅ |
| cc-search-2 | Index SERVICE_CATALOG + actions + fuzzy match + navigate | **M1** ✅ |
| cc-search-3 | conductor `GET /api/search` — project-scoped resource aggregator | |
| cc-search-4 | Recent items, keyboard nav, mobile sheet, `aerekos search` CLI | |

---

## Setup wizards (cc-wizard)

Plan: [service_setup_wizard.md](./service_setup_wizard.md)

| ID | Task | M1 |
|----|------|-----|
| cc-wizard-1 | catalog setup metadata + `GET /api/services/:name/setup` + `/api/setup/graph` | **M1** ✅ |
| cc-wizard-2 | ServiceSetupWizard UI + DependencyChecklist + ManagerConsole Setup tab | **M1** ✅ |
| cc-wizard-3 | Full wizards P1 managers (key, secrets, auth, ai, storage, db, compute) | partial ✅ |
| cc-wizard-4 | Dashboard setup badges, ProjectDetails stack wizard, search "Set up X" | ✅ |
| cc-wizard-5 | `aerekos setup {service}` CLI parity | |

---

## VPC + Headscale (cc-vpc, cc-hs)

Plan: [vpc_network.md](./vpc_network.md)

| ID | Task |
|----|------|
| cc-vpc-1 | Document two-layer model; auto-create default project network on project create |
| cc-vpc-2 | compute_manager + db_manager auto-attach to project Docker network |
| cc-vpc-3 | Headscale on prod + ACL + preauth + tailscale sidecar (see cc-hs-*) |
| cc-vpc-4 | Conductor IPAM + project ACLs; generalize SERVICE_DIRECT_HOSTS via registry |
| cc-vpc-5 | network_manager security groups + setup wizard connectivity probes |
| cc-hs-1 | Headscale server on prod compose, config, API key in secrets_manager |
| cc-hs-2 | ACL HuJSON — tag:platform, tag:project, tag:worker |
| cc-hs-3 | Conductor HeadscaleService — preauth keys on worker register |
| cc-hs-4 | tailscale sidecar on worker docker-compose + deploy env |
| cc-hs-5 | MagicDNS aerekos.internal + overlay service registry |
| cc-hs-6 | self-hosted DERP on prod (NAT fallback) |
| cc-hs-7 | node revoke on worker deregister + key rotation runbook |
| cc-hs-8 | VPC setup wizard + `aerekos vpc status` connectivity probes |
| cc-hs-9 | docs/runbooks/headscale.md + DEPLOYMENT.md overlay migration |

---

## Storage pro (pro-storage)

Plan: [storage_manager.md](./storage_manager.md) · [edge_stack_pro.md](./edge_stack_pro.md)

| ID | Task | M1 |
|----|------|-----|
| pro-storage-1 | requireAuth all routes, ARN/scopes, bucket policies, CORS, signed URL audit | **M1** partial ✅ |
| pro-storage-2 | versioning, lifecycle, multipart resume, quotas, backup bucket target | |
| pro-storage-3 | App access card, setup wizard, CLI parity, scoped e2e tests | partial ✅ |

### pro-storage detail (pro-storage-1 → 23)

- [ ] **pro-storage-1** requireAuth on all routes
- [ ] **pro-storage-2** ARN on bucket create
- [ ] **pro-storage-3** requireResource + scopes on object ops
- [ ] **pro-storage-4** Bucket policies JSON
- [ ] **pro-storage-5** CORS per bucket
- [ ] **pro-storage-6** Signed URL TTL caps + audit
- [ ] **pro-storage-7** MOCK_KEY_MANAGER=false prod only
- [ ] **pro-storage-8** Object versioning
- [ ] **pro-storage-9** Lifecycle rules
- [ ] **pro-storage-10** Multipart upload resume + list parts
- [ ] **pro-storage-11** Object metadata headers
- [ ] **pro-storage-12** Bucket encryption default enforced
- [ ] **pro-storage-13** Soft delete bucket (E6)
- [ ] **pro-storage-14** Per-bucket quotas (E8)
- [ ] **pro-storage-15** Conductor DB backup target (E11)
- [ ] **pro-storage-16** Metrics: bytes, object count, rates
- [ ] **pro-storage-17** Rate limits per app credential
- [ ] **pro-storage-18** App access card
- [ ] **pro-storage-19** Setup wizard
- [ ] **pro-storage-20** Lifecycle + versioning UI
- [ ] **pro-storage-21** `aerekos storage` CLI parity
- [ ] **pro-storage-22** e2e scoped credential one bucket
- [ ] **pro-storage-23** Integration 401/403 AUTH_REQUIRED

---

## Edge pro (pro-edge)

Plan: [edge_stack_pro.md](./edge_stack_pro.md) · [tunnel_manager.md](./tunnel_manager.md) · [domain_manager.md](./domain_manager.md)

| ID | Task | M1 |
|----|------|-----|
| pro-edge-0 | CF token in secrets_manager + Connect Cloudflare wizard + readiness probe | **M1** code ✅ ops pending |
| pro-edge-1 | tunnel_manager ingress, cloudflared, token-once UI, import prod tunnels | partial ✅ code (cloudflared deploy pending) |
| pro-edge-2 | domain_manager zone list, CNAME pairing, DNS validation, EdgeManager DNS tab | partial ✅ zones |
| pro-edge-3 | Public hostname wizard + EdgeManager UI + `aerekos edge` CLI + runbook migration | |
| pro-edge-4 | cdn_manager CF cache rules + purge + EdgeManager CDN tab | |
| pro-edge-5 | balancer_manager health probes + compute target registration | |
| pro-edge-6 | registry_manager pull secrets + setup wizard + credential_ref validation | |
| pro-edge-7 | CF Zero Trust Access + WAF/rate limits on cloud/cloudapi | |

---

## Release & fleet (release-fleet)

Plan: [release_fleet.md](./release_fleet.md)

| ID | Task |
|----|------|
| release-fleet-1 | ReleaseService publish flow documented + CI wires `scripts/release/publish.sh` |
| release-fleet-2 | UpdateService poll/decide + updater sidecar verified on prod + Orin |
| release-fleet-3 | agentAuth hardening + audit fleet update triggers |
| release-fleet-4 | Version drift in Devices UI + rollback/pin version |
| release-fleet-5 | Post-update smoke (e2e Tier 1–4) gate before marking fleet healthy |

---

## Project onboarding (cc-project)

Plan: [project_onboarding.md](./project_onboarding.md)

| ID | Task | M1 |
|----|------|-----|
| cc-project-1 | On project create: default VPC/network row (cc-vpc-1 hook) | |
| cc-project-2 | Optional "Enable core stack" — key → secrets → auth → storage | **M1** ✅ |
| cc-project-3 | Dashboard setup % from day one | **M1** ✅ |
| cc-project-4 | `aerekos project create --enable-core` CLI parity | |

---

## Fleet truth (cc-fleet)

Plan: [host_manager.md](./host_manager.md) · [worker_manager.md](./worker_manager.md) · [worker.md](./worker.md)

| ID | Task |
|----|------|
| cc-fleet-1 | host_manager auto-sync from conductor worker heartbeats |
| cc-fleet-2 | worker_manager annotations synced with Worker model |
| cc-fleet-3 | DeviceDetails: fleet health row (online, version, last smoke) |
| cc-fleet-4 | Worker register → Headscale preauth in one flow (cc-hs-3) |

---

## Alert routing (cc-alerts)

Plan: [observability_alerts.md](./observability_alerts.md)

| ID | Task |
|----|------|
| cc-alerts-1 | Conductor alert rules: manager unhealthy >5m → webhook_manager |
| cc-alerts-2 | Alert payload: project_id, manager, request_id, runbook link |
| cc-alerts-3 | Dashboard alert banner (Animus) for active incidents |
| cc-alerts-4 | Later: email_manager / slack_manager when keys exist |

---

## Ops pre-work (ops-pre) — no code

| ID | Task | M1 |
|----|------|-----|
| ops-pre-1 | Rotate prod JWT_SECRET, AUTH_MANAGER_SECRET, MASTER_KEY | **M1** |
| ops-pre-2 | Store cloudflare.api_token + account_id in secrets_manager | **M1** |
| ops-pre-3 | Write runbook skeletons: deploy.md, incident.md, key-rotation.md | **M1** |
| ops-pre-4 | Catalog honesty pass E30–E31 before more console UI | **M1** |
| ops-pre-5 | Import manual cloud/cloudapi tunnels into tunnel_manager DB (after pro-edge-1) | |

---

## Deferred (defer-3p)

Plan: [enterprise_standards.md](./enterprise_standards.md)

| ID | Task |
|----|------|
| defer-3p | email/sms/slack/crawler execution when provider keys exist |

---

## Post-MVP (post-e46–e54)

Plan: [enterprise_standards.md](./enterprise_standards.md)

| ID | Task |
|----|------|
| post-e46 | Backup conductor HA (hot standby) |
| post-e47 | docs/adr/ architecture decision records |
| post-e48 | SBOM + npm audit in CI on deploy |
| post-e49 | Slug validation middleware on resource create |
| post-e50 | Project membership — users scoped to projects (extends E43) |
| post-e51 | Per-project resource import/export (DR/migration) |
| post-e52 | ~~Enablement wizard~~ → superseded by cc-wizard-* (cancelled) |
| post-e53 | AI model governance — approved model allowlist per project |
| post-e54 | Compliance log export to storage (SOC2 prep) |

---

## Completed

| ID | Task |
|----|------|
| plans-audit | Create linked per-manager production plans (docs/plans/) |
| enterprise-standards | Enterprise standards doc E1–E45 + README updates |
| p0–p9 | Platform app-access golden path + gateway |
| p10-partial | AUTH_REQUIRED wiring, rate limits, git HTTP auth, audit login |
| cc-wizard-1/2 | setupCatalog + SetupService + ServiceSetupWizard |
| cc-project-2/3 | enable_core_stack + dashboard setup % |
| cc-search-1/2 | Command palette + catalog index |
| lock-4, lock-6, lock-7 | Gateway, bespoke queue/webhook/git UIs, catalog tiers |
| e10-skeleton | docs/runbooks/deploy, incident, key-rotation |
| e17 | e2e Tier 6 29/29 |

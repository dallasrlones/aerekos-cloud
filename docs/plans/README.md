# Production plans — master index

> **How to use:** Start with [milestone_m1.md](./milestone_m1.md), then [MASTER_TODOS.md](./MASTER_TODOS.md) for every todo ID. Walk order below for dependency context.  
> **Last audited:** 2026-06-06 against full codebase (34 managers + conductor).  
> **Quality bar:** [enterprise_standards.md](./enterprise_standards.md) — AWS/GCP-level API, CLI ↔ console parity, observability, code gates.  
> **Edge & storage pro:** [edge_stack_pro.md](./edge_stack_pro.md)  
> **Deferred:** Twilio, Slack, SMTP, crawler — [enterprise_standards.md#deferred](./enterprise_standards.md#deferred--third-party-keys-do-later).

---

## Milestone 1 (start here)

**[milestone_m1.md](./milestone_m1.md)** — ship “apps call AI + storage securely” before edge automation, Headscale, or full enterprise backlog.

**[MASTER_TODOS.md](./MASTER_TODOS.md)** — canonical checklist: P0–P10, L1–L11, E1–E45, CC, cc-search/wizard/vpc/hs, pro-storage/edge, release-fleet, cc-project/fleet/alerts, ops-pre, post-MVP.

---

## Walk order (recommended)

Do platform foundation first, then reference implementation, then app-access rollout, then everything else.

| # | Plan | Priority | Why |
|---|------|----------|-----|
| 0 | [platform_app_access.md](./platform_app_access.md) | **P0** | ARN spec, credentials, shared modules — blocks all app-facing managers |
| 1 | [conductor.md](./conductor.md) | **P0** | Proxy auth, IAM enforcement, token passthrough, production hardening |
| 2 | [auth_manager.md](./auth_manager.md) | **P0** | Credential CRUD, dynamic token claims, signing secret bootstrap |
| 3 | [ai_manager.md](./ai_manager.md) | **P1** | Reference implementation (Endpoints + ARN + scope enforcement) |
| 4 | [iam_manager.md](./iam_manager.md) | **P1** | Policy engine must enforce ARNs at conductor edge |
| 5 | [key_manager.md](./key_manager.md) | **P1** | KMS — secrets_manager + storage depend on it in prod |
| 6 | [secrets_manager.md](./secrets_manager.md) | **P1** | App-access + route auth + no MOCK_KEY_MANAGER in prod |
| 7 | [storage_manager.md](./storage_manager.md) · [edge_stack_pro](./edge_stack_pro.md) | **P1** | App-access + **STORAGE-PRO** (S3 parity, lifecycle, policies) |
| 8 | [db_manager.md](./db_manager.md) | **P1** | App-access ARN; connection credential exposure |
| 9 | [compute_manager.md](./compute_manager.md) | **P2** | App-access + manager-edge auth |
| 10 | [queue_manager.md](./queue_manager.md) | **P2** | App-access |
| 11 | [webhook_manager.md](./webhook_manager.md) | **P2** | App-access + retry/DLQ |
| 12 | [git_manager.md](./git_manager.md) | **P2** | App-access + Smart HTTP via auth_manager |
| 13 | [tunnel_manager.md](./tunnel_manager.md) | **P2** | **EDGE-PRO** — CF secrets + cloudflared + ingress |
| 14 | [domain_manager.md](./domain_manager.md) | **P2** | **EDGE-PRO** — zone discovery + DNS wizard + tunnel pairing |
| 15 | [registry_manager.md](./registry_manager.md) | **P3** | **EDGE-PRO-6** — pull secrets + registry metadata |
| 16 | [logs_manager.md](./logs_manager.md) | **P3** | Retention, shipper hardening |
| 17 | [schedule_manager.md](./schedule_manager.md) | **P3** | Distributed cron |
| 18 | [network_manager.md](./network_manager.md) | **P3** | Docker network lifecycle |
| 19 | [api_manager.md](./api_manager.md) | **P2** | Runtime gateway (pretty invoke URLs) — with P9 after AI app-access |
| 20 | [metrics_manager.md](./metrics_manager.md) | **P4** | Scraping + aggregation |
| 21 | [security_manager.md](./security_manager.md) | **P4** | Real findings pipeline |
| 22 | [analytics_manager.md](./analytics_manager.md) | **P4** | Event pipeline |
| 23 | [balancer_manager.md](./balancer_manager.md) | **P3** | **EDGE-PRO-5** — health-checked targets → compute |
| 24 | [cdn_manager.md](./cdn_manager.md) | **P3** | **EDGE-PRO-4** — CF cache rules + purge |
| 25 | [email_manager.md](./email_manager.md) | **DEFERRED** | SMTP/SES when keys available |
| 26 | [sms_manager.md](./sms_manager.md) | **DEFERRED** | Twilio when keys available |
| 27 | [slack_manager.md](./slack_manager.md) | **DEFERRED** | Slack API when token available |
| 28 | [cicd_manager.md](./cicd_manager.md) | **P4** | Pipeline runners |
| 29 | [code_as_infra.md](./code_as_infra.md) | **P4** | Apply/plan engine |
| 30 | [crawler_manager.md](./crawler_manager.md) | **DEFERRED** | Real HTTP crawl (after core platform) |
| 31 | [app_manager.md](./app_manager.md) | **P4** | Deploy integration |
| 32 | [mcp_manager.md](./mcp_manager.md) | **P4** | Live MCP processes |
| 33 | [host_manager.md](./host_manager.md) | **P2** | Fleet inventory — sync from worker heartbeats |
| 34 | [worker_manager.md](./worker_manager.md) | **P2** | Fleet annotations — wire to conductor registry |
| 35 | [system_manager.md](./system_manager.md) | **P5** | Host execution |

### Supporting (not managers)

| Plan | Focus |
|------|-------|
| [worker.md](./worker.md) | Worker node runtime, Orin LAN env, fleet deploy |
| [aerekos_sdk.md](./aerekos_sdk.md) | SDK + CLI app-token and ARN invoke helpers |
| [release_fleet.md](./release_fleet.md) | ReleaseService + updater sidecar + fleet rollouts |
| [project_onboarding.md](./project_onboarding.md) | Default VPC + enable core stack on project create |
| [observability_alerts.md](./observability_alerts.md) | Alert rules → webhook_manager |
| [milestone_m1.md](./milestone_m1.md) | First shippable production slice |
| [MASTER_TODOS.md](./MASTER_TODOS.md) | **Full todo registry** |

Regenerate stub manager plans after catalog changes: `node scripts/gen-manager-plans.mjs`

---

## By category

| Category | Plans |
|----------|-------|
| **Platform** | [platform_app_access](./platform_app_access.md), [conductor](./conductor.md), [project_onboarding](./project_onboarding.md), [release_fleet](./release_fleet.md) |
| **Identity** | [auth_manager](./auth_manager.md), [iam_manager](./iam_manager.md), [secrets_manager](./secrets_manager.md) |
| **Core** | [key_manager](./key_manager.md), [storage_manager](./storage_manager.md), [db_manager](./db_manager.md) |
| **Compute** | [compute_manager](./compute_manager.md), [queue_manager](./queue_manager.md), [schedule_manager](./schedule_manager.md), [network_manager](./network_manager.md), [vpc_network](./vpc_network.md) |
| **Observability** | [logs_manager](./logs_manager.md), [metrics_manager](./metrics_manager.md), [security_manager](./security_manager.md), [analytics_manager](./analytics_manager.md), [observability_alerts](./observability_alerts.md) |
| **Edge** | [edge_stack_pro](./edge_stack_pro.md), [tunnel_manager](./tunnel_manager.md), [domain_manager](./domain_manager.md), [cdn_manager](./cdn_manager.md), [balancer_manager](./balancer_manager.md) |
| **Integrations** | [webhook_manager](./webhook_manager.md), [email_manager](./email_manager.md), [sms_manager](./sms_manager.md), [slack_manager](./slack_manager.md) |
| **Dev tools** | [git_manager](./git_manager.md), [registry_manager](./registry_manager.md), [cicd_manager](./cicd_manager.md), [code_as_infra](./code_as_infra.md), [api_manager](./api_manager.md), [app_manager](./app_manager.md), [mcp_manager](./mcp_manager.md) |
| **AI** | [ai_manager](./ai_manager.md), [crawler_manager](./crawler_manager.md) |
| **Fleet** | [host_manager](./host_manager.md), [worker_manager](./worker_manager.md), [system_manager](./system_manager.md), [worker](./worker.md) |

---

## Cross-cutting production checklist

> **Full IDs:** [MASTER_TODOS.md](./MASTER_TODOS.md). Summary below.

### Ops pre-work (no code) — do first

- [ ] **ops-pre-1** Rotate prod JWT_SECRET, AUTH_MANAGER_SECRET, MASTER_KEY
- [ ] **ops-pre-2** Store cloudflare.api_token + account_id in secrets_manager
- [ ] **ops-pre-3** Runbook skeletons: deploy.md, incident.md, key-rotation.md (E10)
- [ ] **ops-pre-4** Catalog honesty E30–E31 before more console UI
- [ ] **ops-pre-5** Import manual cloud/cloudapi tunnels (after pro-edge-1)

### Security & auth (P0–P2)

- [ ] **p0-primitives** Platform ARN + credential primitives
- [ ] **p1-credentials** auth_manager Credentials CRUD
- [ ] **p2-conductor** appProxyAuth + requireArnScope
- [ ] **p7-iam** iam_manager policy evaluation at conductor edge
- [ ] **lock-1** Unify authManagerClient everywhere
- [ ] **lock-2** AUTH_REQUIRED=true all :31xx ports
- [ ] **lock-5** MOCK_KEY_MANAGER=false prod
- [ ] Rate limits + audit log (P10, E5)

### Platform rollout (P3–P10)

- [ ] **p3–p5** AI reference: endpoints, enforcement, UI
- [ ] **p6-rollout** storage, db, secrets, compute, queue, webhook, git
- [ ] **p8-dx** SDK/CLI getAppToken, invoke, cred commands
- [ ] **p9-api-manager** / **lock-4** api_manager runtime gateway
- [ ] **p10-hardening** enablement UX, secrets, e2e Tier 6

### Console

- [ ] **cc-search-1–4** [global_search.md](./global_search.md)
- [ ] **cc-wizard-1–5** [service_setup_wizard.md](./service_setup_wizard.md)
- [ ] **cc-project-1–4** [project_onboarding.md](./project_onboarding.md)

### VPC + Headscale

- [ ] **cc-vpc-1–5**, **cc-hs-1–9**, **lock-11** [vpc_network.md](./vpc_network.md)

### Edge & storage pro

- [ ] **pro-storage-1–3** (detail pro-storage-1–23) [storage_manager.md](./storage_manager.md)
- [ ] **pro-edge-0–7** [edge_stack_pro.md](./edge_stack_pro.md)

### Fleet & releases

- [ ] **release-fleet-1–5** [release_fleet.md](./release_fleet.md)
- [ ] **cc-fleet-1–4** [host_manager.md](./host_manager.md), [worker_manager.md](./worker_manager.md)
- [ ] **cc-worker-fleet** [worker.md](./worker.md)

### Observability & alerts

- [ ] **cc-alerts-1–4** [observability_alerts.md](./observability_alerts.md)
- [ ] **cc-health-dash**, **cc-prometheus**, **cc-obs-red**, **cc-obs-grafana**, **cc-obs-otel**
- [ ] **E11–E15**, **E45** SLO panel

### Enterprise E1–E45 + CI

- [ ] **e1–e45** [enterprise_standards.md](./enterprise_standards.md)
- [ ] **e19** PR gate — make docs + e2e Tier 1–4 green
- [ ] **cc-def-done** definition of done per manager

### Post-MVP (E46–E54)

Start when P0–P10, L1–L11, E1–E45, CC*, edge/storage pro, release-fleet, and defer-3p complete.

| ID | Item |
|----|------|
| post-e46 | Backup conductor HA |
| post-e47 | docs/adr/ |
| post-e48 | SBOM + npm audit in CI |
| post-e49 | Slug validation middleware |
| post-e50 | Project membership (GA — Friends invites; federation Preview) |
| post-e51 | Resource import/export |
| post-e52 | ~~Wizard~~ → cc-wizard-* (cancelled) |
| post-e53 | AI model governance |
| post-e54 | Compliance log export |

### Deferred

- [ ] **defer-3p** email/sms/slack/crawler when provider keys exist

---

## Implementation tiers (codebase today)

| Tier | Managers |
|------|----------|
| **Production-ready** | conductor, key_manager, storage_manager, db_manager, compute_manager, queue_manager, schedule_manager, network_manager, logs_manager, secrets_manager, webhook_manager, git_manager |
| **Real API, partial** | tunnel_manager, domain_manager, registry_manager, auth_manager, ai_manager |
| **Edge pro target** | tunnel, domain (CF API ready), cdn, balancer (stub → pro) |
| **P4 SQLite stub** | metrics, security, analytics, iam (data only), email, sms, slack, cicd, code_as_infra, crawler, host, mcp, api, app, system, worker |

---

## Related docs

- **[MASTER_TODOS.md](./MASTER_TODOS.md)** — complete todo registry
- **[enterprise_standards.md](./enterprise_standards.md)** — API standards, definition of done
- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [docs/services/README.md](../services/README.md)
- [worker/MANAGER_SERVICES.md](../../worker/MANAGER_SERVICES.md)
- Legacy: [docs/ai_manager_plan.md](../ai_manager_plan.md) → redirects here

# Redundancy audit (W9a)

> **Source:** OSS hardening mega-plan (W9). **Status:** decisions locked for implementation; merges roll out incrementally.  
> **Navigation:** [README](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [enterprise_standards.md](./enterprise_standards.md) · [observability_alerts.md](./observability_alerts.md)

---

## Goal

Ship an **AWS-shaped catalog**: one clear product per job, not ~57 near-clones. Each row below picks **merge**, **keep+narrow**, or **delete/archive** before GA labels are finalized.

---

## Decision table

| Overlap | Decision | Target shape | Migration / notes |
|---------|----------|--------------|-------------------|
| `email_manager` + `sms_manager` + `slack_manager` + channel-like `push_manager` | **Merge** → `notify_manager` | Single service with **Email / Sms / Slack / Push providers**; shared queue + `POST …/test` | **Phase 0 (now):** `worker/shared/notifyProviders.js` + `notifyFacade.js` delegate to legacy managers (`NOTIFY_DELEGATE_LEGACY`). **Phase 1:** route `AlertFanout` + workflow notify steps through facade. **Phase 2:** one SQLite schema + OpenAPI; proxy aliases for old names (6–12 mo). **Do not delete** email/sms/slack until Phase 2. |
| `code_as_infra` vs stack / IaC revisions | **Fold** into stack revision writer | `infra.json` / stack revision = **single writer**; modules become stack snippets | Mark `code_as_infra` **experimental** in catalog; migrate `modules` CRUD to stack API. Retire manager or keep read-only archive. |
| Adonis-in-git vs **Icarus IDE** | **Keep + narrow** (split already chosen) | `git_manager` = hosting (PRs, checks, webhooks → `cicd_manager`); IDE = workspace/editor/deploy | Remove any remaining “IDE inside git_manager” duplication; see [adonis_ide.md](./adonis_ide.md) / [icarus_ide.md](./icarus_ide.md). |
| `event_manager` vs `webhook_manager` vs `websocket_manager` fanout | **Keep + narrow** | **webhook** = HTTP callbacks; **event** = bus; **websocket** = realtime | Shared dispatch lib in `worker/shared`; no triplicate CRUD for the same payload types. |
| `query_manager` vs `analytics_manager` vs `global_search` | **Narrow / partial merge** | Fewer analytics/search surfaces; query = ad-hoc SQL/API where needed | Audit after observability planes (W6) land. |
| `transfer_manager` vs `storage_manager` multipart/copy | **Fold** where possible | Multipart + copy APIs live on **storage** | Transfer becomes storage capability flags, not second product. |
| `status_manager` vs `metrics_manager` “are we up” | **Keep + narrow** | **status** = product health pages; **metrics** = TSDB | Share `managerProbes` / scrape targets; do not duplicate TSDB in status. |
| `worker_manager` shell vs worker agent | **Keep + narrow** | One **worker** story: agent on host; manager = fleet metadata API | Demote duplicate shell UI; conductor registry is SoR. |
| `config_manager` vs `secrets_manager` | **Keep** (both) | **secrets** = sensitive; **config** = non-secret | Only if APIs stay crisp; otherwise merge non-secret config into stack revision docs. |
| `balancer_manager` vs `compute_manager` / `network_manager` ingress | **Align** | Ingress via compute/network; balancer = health-checked targets | Avoid second LB product without depth (EDGE-PRO). |
| `registry_manager` vs parked “container/image manager” | **Keep** one | **registry_manager** = image metadata + pull secrets | No parallel image manager in catalog. |
| Queue / logs / metrics SQLite as “prod” | **Keep + narrow** | **Provider seams** (`QueueProvider`, `LogProvider`, `MetricsProvider`); SQLite = dev/offline only | W6: `local_nats` stub → NATS; Loki/Prometheus adapters; honest GA docs. |

---

## Notify merge detail (phase 0)

| Channel | Legacy manager (kept) | Provider module | Live transport | CI / no keys |
|---------|----------------------|-----------------|----------------|--------------|
| Email | `email_manager` | `EmailProvider` | SMTP / SES via secrets | `MockProvider` + `SKIP_SMTP` |
| SMS | `sms_manager` | `SmsProvider` | Twilio | `MockProvider` — **no Twilio in CI** |
| Slack | `slack_manager` | `SlackProvider` | Webhook / `chat.postMessage` | `MockProvider` + `SKIP_SLACK` |
| Push | `push_manager` | (future `PushProvider`) | FCM | `SKIP_PUSH` |

**Facade:** `worker/shared/notifyFacade.js` — optional `delegate()` posts the same JSON shape legacy managers already accept.

---

## Observability planes (W6 link)

| Plane | Manager API (unchanged) | Local provider (now) | Production backend (later) |
|-------|-------------------------|----------------------|----------------------------|
| Queue | `queue_manager` | `LocalNatsStub` (`AEREKOS_QUEUE_PROVIDER=local_nats`) | NATS JetStream → SQS/Pub/Sub/Service Bus |
| Logs | `logs_manager` | `MemoryLogProvider` / `FileLogProvider` | Loki or file → object storage |
| Metrics | `metrics_manager` + `/metrics` | `LocalPrometheusProvider` | Prometheus scrape → AMP/GCM/etc. |

---

## Maturity labels (post-merge, illustrative)

- **GA:** conductor, worker/updater, key, storage, db, compute, cluster, queue, schedule, network, logs, metrics, iam, secrets, auth, tunnel, domain, cicd, registry, git, api, function, ai, backup, cert, audit, status, **notify** (after merge), webhook, system, download.
- **needs-keys:** Cloudflare live paths (tunnel/domain/cdn); outbound channels inside notify; crawler egress when marked.
- **preview:** specialized managers that survive this audit (mcp, graphql, notebook, iot, waf, vpn, billing, …) — still require behavioral e2e.

---

## Deliverables checklist

- [x] This decision table (`redundancy_audit.md`)
- [ ] Catalog / seed / OpenAPI updates per row
- [ ] Migration notes for renamed routes (`notify_manager`, folded `code_as_infra`)
- [ ] Archive or delete packages only **after** proxy aliases and e2e green

**Gate (W9):** redundancy decisions published + merges executed; 100% of **remaining** managers have behavioral e2e (mock path for third parties).

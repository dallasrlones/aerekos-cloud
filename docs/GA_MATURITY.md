# GA maturity matrix (managers)

Single-page view for **public OSS** and contributors: which managers are generally available (**GA**), which need provider secrets (**needs-keys**), and which are **preview** (metadata/control plane without a full dataplane).

**Sources (regenerate — do not hand-edit the table):**

- `docs/catalog.js` — catalog `status` and `needsKeys` notes (`STATUS_LABEL`: {"implemented":"Implemented","needs-keys":"Implemented · needs provider keys for live calls","experimental":"Experimental · not a GA dataplane; use stack revision APIs"})
- `e2e/catalog.js` — `ALL_MANAGERS` (proxy liveness) and `P4_MANAGERS` (SQLite CRUD round-trip)
- Fleet depth inventory: [`../aerekos-cloud-STATUS.md`](../aerekos-cloud-STATUS.md) §5 (sibling doc; not shipped in mirror)

```bash
node scripts/oss/gen-ga-maturity.mjs
```

## Legend

| Maturity | Meaning |
|----------|---------|
| **GA** | Catalog `implemented`. Safe to enable for projects; e2e exercises the manager through the conductor proxy. |
| **needs-keys** | Catalog `needs-keys`. CRUD and proxy work; live calls to external providers require secrets (store in `secrets_manager`, never in git). |
| **preview** | Control plane present but dataplane incomplete, parked, or operator-only — not marketed as full cloud parity. |

Counts: **47** GA · **9** needs-keys · **1** preview (managers only).

## Manager matrix

| Manager | Port | Category | Catalog | **Maturity** | E2E (`e2e/catalog.js`) | Provider keys |
|---------|------|----------|---------|--------------|-------------------------|---------------|
| `storage_manager` | 3003 | Core | implemented | **GA** | liveness / proxy | — |
| `db_manager` | 3004 | Core | implemented | **GA** | liveness / proxy | — |
| `compute_manager` | 3100 | Compute | implemented | **GA** | liveness / proxy | — |
| `queue_manager` | 3101 | Compute | implemented | **GA** | liveness / proxy | — |
| `key_manager` | 3102 | Core | implemented | **GA** | liveness / proxy | — |
| `schedule_manager` | 3102 | Compute | implemented | **GA** | liveness / proxy | — |
| `network_manager` | 3103 | Compute | implemented | **GA** | liveness / proxy | — |
| `logs_manager` | 3104 | Observability | implemented | **GA** | liveness / proxy | — |
| `metrics_manager` | 3105 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `iam_manager` | 3106 | Identity | implemented | **GA** | liveness / proxy | — |
| `secrets_manager` | 3107 | Identity | implemented | **GA** | liveness / proxy | — |
| `security_manager` | 3108 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `balancer_manager` | 3109 | Edge | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `tunnel_manager` | 3110 | Edge | needs-keys | **needs-keys** | liveness / proxy | yes |
| `domain_manager` | 3111 | Edge | needs-keys | **needs-keys** | liveness / proxy | yes |
| `webhook_manager` | 3112 | Integrations | implemented | **GA** | liveness / proxy | — |
| `email_manager` | 3113 | Integrations | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `sms_manager` | 3114 | Integrations | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `slack_manager` | 3115 | Integrations | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `auth_manager` | 3116 | Identity | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `analytics_manager` | 3117 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `cdn_manager` | 3118 | Edge | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `cicd_manager` | 3119 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `code_as_infra` | 3120 | Dev tools | experimental | **experimental** | liveness + P4 CRUD round-trip | — |
| `crawler_manager` | 3121 | AI | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `host_manager` | 3122 | Platform | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `mcp_manager` | 3123 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `api_manager` | 3124 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `app_manager` | 3125 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `ai_manager` | 3126 | AI | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `system_manager` | 3127 | Platform | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `worker_manager` | 3128 | Platform | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `registry_manager` | 3129 | Dev tools | implemented | **GA** | liveness / proxy | — |
| `git_manager` | 3130 | Dev tools | implemented | **GA** | liveness / proxy | — |
| `websocket_manager` | 3131 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `event_manager` | 3132 | Integrations | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `download_manager` | 3133 | Storage & Content | implemented | **preview** | liveness + P4 CRUD round-trip | — |
| `backup_manager` | 3134 | Storage & Content | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `workflow_manager` | 3135 | Compute | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `config_manager` | 3136 | Identity | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `cert_manager` | 3137 | Identity | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `billing_manager` | 3138 | Management | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `function_manager` | 3139 | Compute | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `iot_manager` | 3140 | Edge | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `graphql_manager` | 3141 | Dev tools | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `notebook_manager` | 3142 | AI | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `trace_manager` | 3143 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `search_manager` | 3144 | Database | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `query_manager` | 3145 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `waf_manager` | 3146 | Edge | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `vpn_manager` | 3147 | Edge | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `transfer_manager` | 3148 | Storage & Content | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `audit_manager` | 3149 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `status_manager` | 3150 | Observability | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `cluster_manager` | 3151 | Compute | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `vector_manager` | 3152 | AI | implemented | **GA** | liveness + P4 CRUD round-trip | — |
| `push_manager` | 3153 | Integrations | needs-keys | **needs-keys** | liveness + P4 CRUD round-trip | yes |
| `notify_manager` | 3154 | Integrations | needs-keys | **needs-keys** | liveness / proxy | yes |

## Conductor features (not managers)

| Feature | Maturity | Doc |
|---------|----------|-----|
| Friends federation (peer attach) | **preview** | [`docs/plans/friends_federation.md`](docs/plans/friends_federation.md) |
| Project Friends (same conductor) | **GA** | [`docs/guides/icarus.md`](docs/guides/icarus.md) |

## Hygiene

- README `/api/v1/info` status vs docs: `node scripts/oss/fix-stub-readmes.js`
- Mirror scrub before publish: `scripts/oss/check-mirror-scrub.sh` (see [`docs/OSS_SCRUB.md`](OSS_SCRUB.md))

# Manager services (worker packages)

Pluggable worker services live under `worker/<name>/`. All listed managers have **SQLite (where applicable)**, **REST** under `GET /api/v1/...`, **`/health` / `/ready`**, and **`/api/v1/info` with `status: "active"`** for the control-plane MVP. **Deeper** integrations (SMTP, Twilio, Slack API, LLM, CI workers, real crawls, etc.) are added later and typically need **env keys**—see per-service `README` / `plan.md`.

**Code generators**

- New empty shells: `node worker/scripts/scaffold-manager-services.mjs` (from `manager-services-manifest.json`)
- P4 batch CRUD layout (re-run with care; overwrites generated files in those folders): `node worker/scripts/generate-p4-sqlite-mvp.mjs`

## Core + edge (MVP+)

| Service | Port | Notes |
|---------|------|--------|
| `key_manager` | 3002 | KMS / encryption keys |
| `storage_manager` | 3003 | Object storage |
| `db_manager` | 3004 | Managed DB control plane |
| `compute_manager` | 3100 | aerekos Compute (tasks + Deployments; dockerode) |
| `queue_manager` | 3101 | SQS-like |
| `schedule_manager` | 3102 | Cron + dispatch (**collides with key_manager 3102** — documented; do not silently reassign key) |
| `network_manager` | 3103 | Per-project Docker networks |
| `logs_manager` | 3104 | `/api/v1/logs` (+ batch/compact); append-only ingest/query; ManagerConsole guide; no prod mocks |
| `iam_manager` | 3106 | RBAC (authZ data) |
| `secrets_manager` | 3107 | Encrypted secrets |
| `tunnel_manager` | 3110 | Cloudflare Tunnel (needs `CLOUDFLARE_*`) |
| `domain_manager` | 3111 | Cloudflare DNS (needs `CLOUDFLARE_*`) |
| `registry_manager` | 3129 | Registry metadata + public config (no pull secrets) |
| `git_manager` | 3130 | Self-hosted Git hosting (CodeCommit-style); real clone/push/pull over Smart HTTP at `/git/:project/:repo.git` |

`GET /metrics` (Prometheus text) is wired on conductor, worker agent, several managers; see each `index.js`.

## P4 control-plane (SQLite CRUD, no live provider in default tests)

| Service | Port | Main route | Without keys you get |
|---------|------|------------|----------------------|
| `metrics_manager` | 3105 | `/api/v1/series` | Stored metric samples |
| `security_manager` | 3108 | `/api/v1/findings` + `POST …/scan` | Findings CRUD; metadata-only scan (no live scanner) |
| `balancer_manager` | 3109 | `/api/v1/targets` | Target hints (no cloud LB) |
| `webhook_manager` | 3112 | `/api/v1/webhooks` + `POST …/dispatch` | Outbound HTTP or **`SKIP_OUTBOUND=1`** (no network) |
| `email_manager` | 3113 | `/api/v1/messages` | Queued; outbound send disabled |
| `sms_manager` | 3114 | `/api/v1/messages` | Queued; outbound send disabled |
| `slack_manager` | 3115 | `/api/v1/messages` + `POST …/send` | Messages CRUD; Slack send when keys exist else queue-only |
| `auth_manager` | 3116 | `/api/v1/providers`, `/credentials`, `/users`, `/auth/*` | OIDC *metadata* + app credentials + users + JWT; IdP **client_secret** in `secrets_manager` |
| `analytics_manager` | 3117 | `/api/v1/events` | Analytics events |
| `cdn_manager` | 3118 | `/api/v1/rules`, `/purge` | Cache rules CRUD + CF purge; Cache Rulesets write parked |
| `cicd_manager` | 3119 | `/api/v1/pipelines` | Pipeline definitions (JSON) |
| `code_as_infra` | 3120 | `/api/v1/modules` | IaC modules/snippets CRUD; no apply engine (experimental) |
| `crawler_manager` | 3121 | `/api/v1/jobs` | Jobs CRUD + `run`/`canary` (single-URL); live egress needs-keys |
| `host_manager` | 3122 | `/api/v1/hosts` | Host inventory |
| `mcp_manager` | 3123 | `/api/v1/tools` | MCP tool registry |
| `api_manager` | 3124 | `/api/v1/endpoints` | Gateway route definitions |
| `app_manager` | 3125 | `/api/v1/apps` | App metadata + FE scaffold; deploy via compute/cicd/tunnel |
| `ai_manager` | 3126 | `/api/v1/intelligence` (+ `/models`, agents, Icarus) | Model/intelligence routing; **no** inference until LLM/URL + keys set; console `/icarus` |
| `system_manager` | 3127 | `/api/v1/tasks` + `/hosts/:id/check` | Tasks CRUD + host OS/Docker check/update (conductor proxy); live e2e parked; no prod SKIP_HOST_PATCH |
| `worker_manager` | 3128 | `/api/v1/annotations` | Worker/fleet labels + sync from Devices |
| `backup_manager` | 3134 | `/api/v1/jobs` | Snapshots into `aerekos-backups` + restore |
| `workflow_manager` | 3135 | `/api/v1/machines` | State machines subset; outbound notify skipped; tutorial none |
| `config_manager` | 3136 | `/api/v1/namespaces` | Flags + `/evaluate` |
| `cert_manager` | 3137 | `/api/v1/certs` | Import PEM or mint self-signed; no ACME; tutorial none |
| `billing_manager` | 3138 | `/api/v1/meters` | Real quota (never unlimited stub) |
| `iot_manager` | 3140 | `/api/v1/things` + `/publish` | Things CRUD + websocket fan-out; MQTT broker parked |
| `graphql_manager` | 3141 | `/api/v1/execute` | GraphQL against Data API models |
| `notebook_manager` | 3142 | `/api/v1/notebooks` | Run via compute oneshot |
| `trace_manager` | 3143 | `/api/v1/traces` | OTLP ingest + span query |
| `search_manager` | 3144 | `/api/v1/indexes` + `/index` + `/query` | Indexes CRUD + FTS5 hits; live e2e parked; no prod mocks |
| `vpn_manager` | 3147 | `/api/v1/peers` | Headscale hookup if `HEADSCALE_URL` |
| `transfer_manager` | 3148 | `/api/v1/endpoints` | Object copy via storage |
| `cluster_manager` | 3151 | `/api/v1/clusters` | Detect/install k3s on explicit click |
| `websocket_manager` | 3131 | `/api/v1/channels` + WSS `/ws` | Channel CRUD + HTTP publish; not conductor Socket.IO |
| `push_manager` | 3153 | `/api/v1/subscriptions` | Queued; outbound send disabled |

**Core (not in P4 table):** worker agent (3001).

**Conductor:** all of the above are in `conductor/scripts/seedServices.js` and `ensureMissingDefaultServices` (port map in `config` JSON).

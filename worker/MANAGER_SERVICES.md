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
| `compute_manager` | 3100 | ECS-style tasks (dockerode) |
| `queue_manager` | 3101 | SQS-like |
| `schedule_manager` | 3102 | Cron + dispatch |
| `network_manager` | 3103 | Per-project Docker networks |
| `logs_manager` | 3104 | Log events |
| `iam_manager` | 3106 | RBAC (authZ data) |
| `secrets_manager` | 3107 | Encrypted secrets |
| `tunnel_manager` | 3110 | Cloudflare Tunnel (needs `CLOUDFLARE_*`) |
| `domain_manager` | 3111 | Cloudflare DNS (needs `CLOUDFLARE_*`) |
| `registry_manager` | 3129 | Registry discovery (no pull secrets) |
| `git_manager` | 3130 | Self-hosted Git hosting (CodeCommit-style); real clone/push/pull over Smart HTTP at `/git/:project/:repo.git` |

`GET /metrics` (Prometheus text) is wired on conductor, worker agent, several managers; see each `index.js`.

## P4 control-plane (SQLite CRUD, no live provider in default tests)

| Service | Port | Main route | Without keys you get |
|---------|------|------------|----------------------|
| `metrics_manager` | 3105 | `/api/v1/series` | Stored metric samples |
| `security_manager` | 3108 | `/api/v1/findings` | Security finding rows |
| `balancer_manager` | 3109 | `/api/v1/targets` | Target hints (no cloud LB) |
| `webhook_manager` | 3112 | `/api/v1/webhooks` + `POST …/dispatch` | Outbound HTTP or **`SKIP_OUTBOUND=1`** (no network) |
| `email_manager` | 3113 | `/api/v1/messages` | Queued; outbound send disabled |
| `sms_manager` | 3114 | `/api/v1/messages` | Queued; outbound send disabled |
| `slack_manager` | 3115 | `/api/v1/messages` | Queued; outbound send disabled |
| `auth_manager` | 3116 | `/api/v1/providers` | OIDC *metadata*; keep **client_secret** in `secrets_manager` |
| `analytics_manager` | 3117 | `/api/v1/events` | Analytics events |
| `cdn_manager` | 3118 | `/api/v1/rules` | CDN-style rules (config only) |
| `cicd_manager` | 3119 | `/api/v1/pipelines` | Pipeline definitions (JSON) |
| `code_as_infra` | 3120 | `/api/v1/modules` | Snippets / small IaC blobs |
| `crawler_manager` | 3121 | `/api/v1/jobs` | Crawl job metadata; add fetch with network later |
| `host_manager` | 3122 | `/api/v1/hosts` | Host inventory |
| `mcp_manager` | 3123 | `/api/v1/tools` | MCP tool registry |
| `api_manager` | 3124 | `/api/v1/endpoints` | Gateway route definitions |
| `app_manager` | 3125 | `/api/v1/apps` | App project metadata |
| `ai_manager` | 3126 | `/api/v1/models` | Model routing config; **no** inference call until LLM/URL + keys set |
| `system_manager` | 3127 | `/api/v1/tasks` + `/hosts/:id/check` | Host OS/Docker check+update (always on) |
| `worker_manager` | 3128 | `/api/v1/annotations` | Worker/fleet labels + sync from Devices |
| `backup_manager` | 3134 | `/api/v1/jobs` | Snapshots into `aerekos-backups` + restore |
| `workflow_manager` | 3135 | `/api/v1/machines` | State machines (email/sms/slack steps skipped) |
| `config_manager` | 3136 | `/api/v1/namespaces` | Flags + `/evaluate` |
| `cert_manager` | 3137 | `/api/v1/certs` | Import PEM or mint self-signed |
| `billing_manager` | 3138 | `/api/v1/meters` | Real quota (never unlimited stub) |
| `graphql_manager` | 3141 | `/api/v1/execute` | GraphQL against Data API models |
| `notebook_manager` | 3142 | `/api/v1/notebooks` | Run via compute oneshot |
| `trace_manager` | 3143 | `/api/v1/traces` | OTLP ingest + span query |
| `search_manager` | 3144 | `/api/v1/query` | SQLite FTS hits |
| `vpn_manager` | 3147 | `/api/v1/peers` | Headscale hookup if `HEADSCALE_URL` |
| `transfer_manager` | 3148 | `/api/v1/endpoints` | Object copy via storage |
| `cluster_manager` | 3149 | `/api/v1/clusters` | Detect/install k3s on explicit click |
| `push_manager` | 3153 | `/api/v1/subscriptions` | Queued; outbound send disabled |

**Core (not in P4 table):** worker agent (3001).

**Conductor:** all of the above are in `conductor/scripts/seedServices.js` and `ensureMissingDefaultServices` (port map in `config` JSON).

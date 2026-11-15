# aerekos-cloud — service reference

Your self-hosted "private AWS": a conductor control plane + **57 manager services**.
All managers are reached through the conductor proxy: `{VERB} {CONDUCTOR}/api/services/{name}{path}`.

See the [web docs](../site/index.html) for a searchable browser. This index and every
per-service page are generated from [`docs/catalog.js`](../catalog.js) via `make docs`.

## [Conductor](conductor.md) — control plane (port 3000)

## Core

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`key_manager`](key_manager.md) | KMS | 3002 | implemented | Key management service: symmetric/data keys, envelope encryption, rotation. |
| [`storage_manager`](storage_manager.md) | S3 | 3003 | implemented | Object storage: buckets + objects with envelope encryption, multipart/chunked uploads, and signed URLs. |
| [`db_manager`](db_manager.md) | RDS | 3004 | implemented | Managed database control plane: provision/start/stop/restart database containers, backups + restore, health and volumes. |

## Compute

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`compute_manager`](compute_manager.md) | ECS / Fargate | 3100 | implemented | Run containerized tasks (dockerode): create/list/get/stop/delete project-scoped tasks with port maps and labels. |
| [`queue_manager`](queue_manager.md) | SQS | 3101 | implemented | Project-scoped queues (SQLite/fifo/rabbitmq/redis_stream); at-least-once + visibility; no capacity-wait auto-create. |
| [`schedule_manager`](schedule_manager.md) | EventBridge Scheduler | 3102 | implemented | Cron schedules that dispatch to a webhook or a queue. |
| [`network_manager`](network_manager.md) | VPC | 3103 | implemented | Per-project Docker bridge networks with stable names. |
| [`workflow_manager`](workflow_manager.md) | Step Functions | 3135 | implemented | State machines (subset ASL). Outbound notify skipped. Tutorial: none. No prod mocks. |
| [`function_manager`](function_manager.md) | Lambda | 3139 | implemented | Lambda analog. |
| [`cluster_manager`](cluster_manager.md) | EKS | 3151 | implemented | Host Docker fleet + optional confirm-only k3s; EKS analog. |

## Observability

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`logs_manager`](logs_manager.md) | CloudWatch Logs | 3104 | implemented | Append-only logs + batch/query/compact; ManagerConsole guide; no prod mocks. |
| [`metrics_manager`](metrics_manager.md) | CloudWatch Metrics | 3105 | implemented | Stored metric samples (name/value/labels). |
| [`security_manager`](security_manager.md) | Security Hub | 3108 | implemented | Security finding records (severity/source/details). |
| [`analytics_manager`](analytics_manager.md) | Pinpoint / Kinesis Analytics | 3117 | implemented | Product analytics events (event/value/properties). |
| [`trace_manager`](trace_manager.md) | X-Ray | 3143 | implemented | OTLP/HTTP ingest plus span list/query in SQLite. |
| [`query_manager`](query_manager.md) | Athena | 3145 | implemented | Query defs CRUD + per-project SQLite `/sql`; Athena analog; no prod SKIP_DUCKDB. |
| [`audit_manager`](audit_manager.md) | CloudTrail | 3149 | implemented | Audit events. |
| [`status_manager`](status_manager.md) | Statuspage | 3150 | implemented | Status incidents. |

## Identity

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`iam_manager`](iam_manager.md) | IAM | 3106 | implemented | Roles, policies, bindings, and evaluate (conductor edge when IAM_ENFORCE_PROXY). |
| [`secrets_manager`](secrets_manager.md) | Secrets Manager | 3107 | implemented | Encrypted secrets (AES-256-GCM envelope via key_manager). |
| [`auth_manager`](auth_manager.md) | Cognito | 3116 | needs-keys | OIDC provider metadata (issuer/client_id/config). |
| [`config_manager`](config_manager.md) | AppConfig | 3136 | implemented | Config namespaces plus /evaluate. Tutorial: none. No prod mocks. |
| [`cert_manager`](cert_manager.md) | ACM | 3137 | implemented | Import PEM or mint self-signed. Tutorial: none. No prod mocks. |

## Edge

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`tunnel_manager`](tunnel_manager.md) | Cloudflare Tunnel | 3110 | needs-keys | Create/delete Cloudflare tunnels (cloudflared) from the edge to private origins. |
| [`domain_manager`](domain_manager.md) | Route 53 | 3111 | needs-keys | Cloudflare DNS + hostnames; tutorial none; no prod mocks. |
| [`cdn_manager`](cdn_manager.md) | CloudFront | 3118 | implemented | Cache rules CRUD + CF purge; Cache Rulesets write parked. |
| [`balancer_manager`](balancer_manager.md) | ELB | 3109 | implemented | Load-balancer target hints (addresses). |
| [`iot_manager`](iot_manager.md) | IoT Core | 3140 | implemented | Things CRUD + publish (websocket fan-out); MQTT parked; ManagerConsole (no ServiceGuide). |
| [`waf_manager`](waf_manager.md) | WAF | 3146 | implemented | WAF rules. |
| [`vpn_manager`](vpn_manager.md) | Client VPN | 3147 | implemented | Headscale preauth keys when HEADSCALE_URL is set; otherwise not-hooked-up. |

## Integrations

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`webhook_manager`](webhook_manager.md) | EventBridge / SNS (HTTP) | 3112 | implemented | Outbound webhooks: endpoints with secret + headers, and a dispatch action. |
| [`email_manager`](email_manager.md) | SES | 3113 | needs-keys | Messages CRUD + send (queue without SMTP); ManagerConsole (no ServiceGuide). |
| [`sms_manager`](sms_manager.md) | SNS SMS | 3114 | needs-keys | SMS messages (to_number/body). |
| [`slack_manager`](slack_manager.md) | Chatbot | 3115 | needs-keys | Slack posts (channel/text). |
| [`event_manager`](event_manager.md) | EventBridge | 3132 | implemented | Buses/rules + put events; ManagerConsole (no ServiceGuide). |
| [`push_manager`](push_manager.md) | SNS mobile | 3153 | implemented | Push subscriptions. |

## Dev tools

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`git_manager`](git_manager.md) | CodeCommit | 3130 | implemented | Self-hosted Git hosting: bare repos + full clone/push/pull over Git Smart HTTP, plus push-event hooks. |
| [`registry_manager`](registry_manager.md) | ECR | 3129 | implemented | Container registry discovery: per-project registry entries (no pull secrets) + a public config endpoint. |
| [`cicd_manager`](cicd_manager.md) | CodePipeline | 3119 | implemented | Pipeline definitions (steps JSON + state). |
| [`code_as_infra`](code_as_infra.md) | CloudFormation | 3120 | implemented | Infrastructure-as-code modules / snippets (kind + content). |
| [`api_manager`](api_manager.md) | API Gateway | 3124 | implemented | Gateway route definitions (method/public_path/backend_url). |
| [`app_manager`](app_manager.md) | Amplify / App Runner | 3125 | implemented | App project metadata (repo_url/build_command). |
| [`mcp_manager`](mcp_manager.md) | Bedrock Agents (tools) | 3123 | implemented | MCP tool registry (description + input_schema). |
| [`websocket_manager`](websocket_manager.md) | API Gateway WebSocket | 3131 | implemented | Channel CRUD + HTTP publish + WSS `/ws`; not conductor Socket.IO. |
| [`graphql_manager`](graphql_manager.md) | AppSync | 3141 | implemented | Subset GraphQL compile/execute → Data API; ManagerConsole (no ServiceGuide). |

## AI

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`ai_manager`](ai_manager.md) | Bedrock | 3126 | needs-keys | Icarus console (/icarus): talk + live plan graph, Fleet, Models, Apps. |
| [`crawler_manager`](crawler_manager.md) | Glue Crawler | 3121 | needs-keys | Jobs CRUD + run/canary (single-URL); ManagerConsole (no ServiceGuide). |
| [`notebook_manager`](notebook_manager.md) | SageMaker notebook | 3142 | implemented | Store notebooks; Run launches a compute oneshot (jupyter/python). |
| [`vector_manager`](vector_manager.md) | OpenSearch kNN | 3152 | implemented | Upsert/query via db_manager vectors or sqlite cosine (facade, not a second RAG). |

## Platform

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`host_manager`](host_manager.md) | EC2 / SSM inventory | 3122 | implemented | Hosts CRUD + sync from `/api/workers`; ManagerConsole (no ServiceGuide). |
| [`worker_manager`](worker_manager.md) | SSM fleet / tags | 3128 | implemented | Worker/fleet labels synced from conductor /api/workers. |
| [`system_manager`](system_manager.md) | Systems Manager | 3127 | implemented | Fleet patch board plus host OS/Docker check and update. |

## Storage & Content

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`download_manager`](download_manager.md) | MediaConvert + ingest | 3133 | implemented | Lists/items + qbit/yt-dlp; DownloadManager screen (no ServiceGuide). |
| [`backup_manager`](backup_manager.md) | AWS Backup | 3134 | implemented | Backup vaults and snapshot jobs into the aerekos-backups bucket. |
| [`transfer_manager`](transfer_manager.md) | Transfer Family | 3148 | implemented | SFTP endpoints that put/get objects through storage_manager. |

## Management

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`billing_manager`](billing_manager.md) | Cost Explorer | 3138 | implemented | Usage meters. |

## Database

| Service | AWS analog | Port | Status | Summary |
|---------|-----------|------|--------|---------|
| [`search_manager`](search_manager.md) | OpenSearch | 3144 | implemented | SQLite FTS search. |

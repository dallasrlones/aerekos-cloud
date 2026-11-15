# Tutorials & ServiceGuide index

Honest Wave 9 inventory of per-manager **tutorial** coverage. This page is the ship bar for `x-tutorials` — not a promise that every manager has a walkthrough.

**Status legend**

| Status | Meaning |
|--------|---------|
| **exists** | In-app `ServiceGuide` (dedicated screen or `CONSOLE_GUIDES`) and/or a standalone guide under `docs/guides/` |
| **none yet** | No dedicated ServiceGuide copy and no standalone tutorial (generic ManagerConsole / README / OpenAPI only) |

**Related**

- UX building blocks: [`docs/ux/service-guide.md`](../ux/service-guide.md)
- Per-service API reference: [`docs/services/README.md`](../services/README.md)
- Maturity matrix: [`docs/GA_MATURITY.md`](../GA_MATURITY.md)
- Standalone guide today: [`icarus.md`](./icarus.md) (`ai_manager`)

There is **no** `docs/tutorials/` tree yet. Do not invent full tutorials for every manager in this wave — use this index + honesty pointers instead.

## Manager matrix

| Manager | Tutorial status | Where (if exists) |
|---------|-----------------|-------------------|
| `ai_manager` | **exists** | ServiceGuide on AIManager / Icarus · [`docs/guides/icarus.md`](./icarus.md) |
| `analytics_manager` | **none yet** | — |
| `api_manager` | **exists** | ServiceGuide on ApiGatewayManager |
| `app_manager` | **none yet** | — |
| `audit_manager` | **none yet** | — |
| `auth_manager` | **none yet** | AuthManager screen (no ServiceGuide component) |
| `backup_manager` | **none yet** | — |
| `balancer_manager` | **none yet** | — |
| `billing_manager` | **none yet** | — |
| `cdn_manager` | **none yet** | — |
| `cert_manager` | **none yet** | — |
| `cicd_manager` | **none yet** | CicdManager screen (no ServiceGuide) |
| `cluster_manager` | **none yet** | — |
| `code_as_infra` | **none yet** | — |
| `compute_manager` | **exists** | ServiceGuide on ComputeManager |
| `config_manager` | **none yet** | — |
| `crawler_manager` | **none yet** | — |
| `db_manager` | **exists** | ServiceGuide on DatabaseManager |
| `domain_manager` | **none yet** | — |
| `download_manager` | **none yet** | DownloadManager screen (no ServiceGuide) |
| `email_manager` | **none yet** | — |
| `event_manager` | **none yet** | — |
| `function_manager` | **exists** | ServiceGuide on FunctionManager |
| `git_manager` | **exists** | ServiceGuide on GitManager |
| `graphql_manager` | **none yet** | — |
| `host_manager` | **none yet** | — |
| `iam_manager` | **exists** | `CONSOLE_GUIDES.iam_manager` |
| `iot_manager` | **none yet** | — |
| `key_manager` | **exists** | ServiceGuide on KeyManager |
| `logs_manager` | **exists** | `CONSOLE_GUIDES.logs_manager` |
| `mcp_manager` | **none yet** | — |
| `metrics_manager` | **exists** | `CONSOLE_GUIDES.metrics_manager` |
| `network_manager` | **none yet** | — |
| `notebook_manager` | **none yet** | — |
| `notify_manager` | **none yet** | Unified facade; generic ManagerConsole only |
| `push_manager` | **none yet** | — |
| `query_manager` | **none yet** | — |
| `queue_manager` | **exists** | ServiceGuide on QueueManager |
| `registry_manager` | **none yet** | — |
| `schedule_manager` | **none yet** | — |
| `search_manager` | **none yet** | — |
| `secrets_manager` | **exists** | ServiceGuide on Key Manager → Service secrets |
| `security_manager` | **none yet** | — |
| `slack_manager` | **none yet** | — |
| `sms_manager` | **none yet** | — |
| `status_manager` | **none yet** | — |
| `storage_manager` | **exists** | ServiceGuide on StorageManager |
| `system_manager` | **none yet** | — |
| `trace_manager` | **none yet** | — |
| `transfer_manager` | **none yet** | — |
| `tunnel_manager` | **none yet** | — |
| `vector_manager` | **none yet** | — |
| `vpn_manager` | **none yet** | — |
| `waf_manager` | **none yet** | — |
| `webhook_manager` | **none yet** | — |
| `websocket_manager` | **none yet** | — |
| `worker_manager` | **none yet** | — |
| `workflow_manager` | **none yet** | — |

**Counts (Wave 9):** **13** exists · **45** none yet (58 managers).

## Source of truth for “exists”

Inspect conductor code, not stale README one-liners:

- Dedicated screens importing `ServiceGuide`: Storage, Key (+ Service secrets), Database, Compute, Queue, Function, ApiGateway, AI / Icarus, Git
- Shared copy: `CONSOLE_GUIDES` in `conductor/app/screens/ManagerConsole/ManagerConsole.jsx` (`logs_manager`, `metrics_manager`, `iam_manager`)

This index wins when a `docs/services/*.md` or worker README disagrees.

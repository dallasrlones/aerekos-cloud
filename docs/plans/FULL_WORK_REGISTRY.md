# Full work registry

**Updated:** 2026-11-15  
**Plan:** Cursor `full_work_parallel_churn`  
**Parallelism:** 8 agents/wave · park blockers · continue  
**Isolation:** each `mgr-*` agent works only in a git worktree under `aerekos/.wt/` or `aerekos/wt/` — never `git checkout` the primary `aerekos-cloud` tree off `main`.

## DoD (manager closeout)

Health/proxy (or parked) · unit/e2e · README + docs/services honesty · OpenAPI if any · SDK/CLI if any · tutorial/ServiceGuide or explicit none · no prod mocks

## Status legend

`pending` · `in_progress` · `done` · `parked`

## Ops

| id | type | owner_path | status | blocker | notes |
|----|------|------------|--------|---------|-------|
| `ops-gate0` | ops | fleet prod | parked | cloud 530 + CF SSH handshake fail 2026-11-15 | retry when tunnel/LAN up; JWT_SECRET on auth_manager + inventory 200s |
| `ops-conductor` | ops | `conductor/` | pending | | control-plane closeout |

## Managers (58)

| id | type | owner_path | status | blocker | notes |
|----|------|------------|--------|---------|-------|
| `mgr-ai_manager` | manager | `worker/ai_manager` | pending | | closeout DoD |
| `mgr-analytics_manager` | manager | `worker/analytics_manager` | pending | | closeout DoD |
| `mgr-api_manager` | manager | `worker/api_manager` | pending | | closeout DoD |
| `mgr-app_manager` | manager | `worker/app_manager` | pending | | closeout DoD |
| `mgr-audit_manager` | manager | `worker/audit_manager` | pending | | closeout DoD |
| `mgr-auth_manager` | manager | `worker/auth_manager` | done | | Wave 1 closeout on `.wt/mgr-auth_manager` (`work/mgr-auth_manager`) |
| `mgr-backup_manager` | manager | `worker/backup_manager` | pending | | closeout DoD |
| `mgr-balancer_manager` | manager | `worker/balancer_manager` | pending | | closeout DoD |
| `mgr-billing_manager` | manager | `worker/billing_manager` | pending | | closeout DoD |
| `mgr-cdn_manager` | manager | `worker/cdn_manager` | pending | | closeout DoD |
| `mgr-cert_manager` | manager | `worker/cert_manager` | pending | | closeout DoD |
| `mgr-cicd_manager` | manager | `worker/cicd_manager` | pending | | closeout DoD |
| `mgr-cluster_manager` | manager | `worker/cluster_manager` | pending | | closeout DoD |
| `mgr-code_as_infra` | manager | `worker/code_as_infra` | pending | | closeout DoD |
| `mgr-compute_manager` | manager | `worker/compute_manager` | pending | | closeout DoD |
| `mgr-config_manager` | manager | `worker/config_manager` | in_progress | | Wave 1 salvage 718c90c; finish DoD |
| `mgr-crawler_manager` | manager | `worker/crawler_manager` | pending | | closeout DoD |
| `mgr-db_manager` | manager | `worker/db_manager` | done | | Wave 1 closeout: health/proxy, `/api/info`, docs/OpenAPI, tests 61; e2e `e2e/db-rds.js` needs live conductor |
| `mgr-domain_manager` | manager | `worker/domain_manager` | pending | | closeout DoD |
| `mgr-download_manager` | manager | `worker/download_manager` | pending | | closeout DoD |
| `mgr-email_manager` | manager | `worker/email_manager` | pending | | closeout DoD |
| `mgr-event_manager` | manager | `worker/event_manager` | pending | | closeout DoD |
| `mgr-function_manager` | manager | `worker/function_manager` | pending | | closeout DoD |
| `mgr-git_manager` | manager | `worker/git_manager` | pending | | closeout DoD |
| `mgr-graphql_manager` | manager | `worker/graphql_manager` | pending | | closeout DoD |
| `mgr-host_manager` | manager | `worker/host_manager` | pending | | closeout DoD |
| `mgr-iam_manager` | manager | `worker/iam_manager` | in_progress | | Wave 1 salvage 2791fd9; finish DoD |
| `mgr-iot_manager` | manager | `worker/iot_manager` | pending | | closeout DoD |
| `mgr-key_manager` | manager | `worker/key_manager` | done | | Wave 1 closeout `c8f8c4f` on `.wt/mgr-key_manager` (`work/mgr-key_manager`): port 3102 + isLiveness docs, OpenAPI, unit/integration, SDK/CLI/tutorial notes, no prod weak MASTER_KEY |
| `mgr-logs_manager` | manager | `worker/logs_manager` | pending | | closeout DoD |
| `mgr-mcp_manager` | manager | `worker/mcp_manager` | pending | | closeout DoD |
| `mgr-metrics_manager` | manager | `worker/metrics_manager` | pending | | closeout DoD |
| `mgr-network_manager` | manager | `worker/network_manager` | pending | | closeout DoD |
| `mgr-notebook_manager` | manager | `worker/notebook_manager` | pending | | closeout DoD |
| `mgr-notify_manager` | manager | `worker/notify_manager` | pending | | closeout DoD |
| `mgr-push_manager` | manager | `worker/push_manager` | pending | | closeout DoD |
| `mgr-query_manager` | manager | `worker/query_manager` | pending | | closeout DoD |
| `mgr-queue_manager` | manager | `worker/queue_manager` | in_progress | | Wave 1 salvage c56ca6b; finish DoD |
| `mgr-registry_manager` | manager | `worker/registry_manager` | pending | | closeout DoD |
| `mgr-schedule_manager` | manager | `worker/schedule_manager` | pending | | closeout DoD |
| `mgr-search_manager` | manager | `worker/search_manager` | pending | | closeout DoD |
| `mgr-secrets_manager` | manager | `worker/secrets_manager` | in_progress | | Wave 1 salvage c0d0b06; finish DoD |
| `mgr-security_manager` | manager | `worker/security_manager` | pending | | closeout DoD |
| `mgr-slack_manager` | manager | `worker/slack_manager` | pending | | closeout DoD |
| `mgr-sms_manager` | manager | `worker/sms_manager` | pending | | closeout DoD |
| `mgr-status_manager` | manager | `worker/status_manager` | pending | | closeout DoD |
| `mgr-storage_manager` | manager | `worker/storage_manager` | done | | Wave 1 closeout 88291cb on `work/mgr-storage_manager` (salvage e249d5e); health/proxy + `/api/info`, OpenAPI, SDK `client.storage`, tests 110, no prod mocks; live proxy checklist manual |
| `mgr-system_manager` | manager | `worker/system_manager` | pending | | closeout DoD |
| `mgr-trace_manager` | manager | `worker/trace_manager` | pending | | closeout DoD |
| `mgr-transfer_manager` | manager | `worker/transfer_manager` | pending | | closeout DoD |
| `mgr-tunnel_manager` | manager | `worker/tunnel_manager` | pending | | closeout DoD |
| `mgr-vector_manager` | manager | `worker/vector_manager` | pending | | closeout DoD |
| `mgr-vpn_manager` | manager | `worker/vpn_manager` | pending | | closeout DoD |
| `mgr-waf_manager` | manager | `worker/waf_manager` | pending | | closeout DoD |
| `mgr-webhook_manager` | manager | `worker/webhook_manager` | pending | | closeout DoD |
| `mgr-websocket_manager` | manager | `worker/websocket_manager` | pending | | closeout DoD |
| `mgr-worker_manager` | manager | `worker/worker_manager` | pending | | closeout DoD |
| `mgr-workflow_manager` | manager | `worker/workflow_manager` | pending | | closeout DoD |

## Cross-cutting

| id | type | owner_path | status | blocker | notes |
|----|------|------------|--------|---------|-------|
| `x-sdk` | cross | platform | pending | | SDK surfaces vs managers |
| `x-cli` | cross | platform | pending | | CLI commands/docs parity |
| `x-openapi` | cross | platform | pending | | OpenAPI pack current |
| `x-tutorials` | cross | platform | pending | | Tutorials / ServiceGuide index |
| `x-cross-service` | cross | platform | pending | | Cross-service consumption pass |
| `x-user-system-safe` | cross | platform | pending | | Undeletable system resources |
| `x-cross-platform` | cross | platform | pending | | Compose one-shot + offline image cache |
| `x-git-iac-all-projects` | cross | platform | pending | | All projects on git_manager + IaC |
| `x-pr-review-ux` | cross | platform | pending | | User review PRs on project code changes |

## Epics (from docs/todo.md)

| id | type | owner_path | status | blocker | notes |
|----|------|------------|--------|---------|-------|
| `epic-icarus-tasks` | epic | docs/todo.md | pending | | Icarus task graph / % / history / user kanban |
| `epic-smart-memory` | epic | docs/todo.md | pending | | LLM+Laya smart memory lookups |
| `epic-finetune-embed` | epic | docs/todo.md | pending | | Fine-tune + embedding Laya gates DRY |
| `epic-aerekos-record` | epic | docs/todo.md | pending | | aerekos-record multi-DB ORM + migrate cloud |
| `epic-memory-crud-ui` | epic | docs/todo.md | pending | | Memory CRUD + brain graph UI |
| `epic-personality-context` | epic | docs/todo.md | pending | | Personality/goals/datetime context |
| `epic-gary-tan-report` | epic | docs/todo.md | pending | | Gary Tan second-brain/harness report MD |
| `epic-aerekos-drive` | epic | docs/todo.md | pending | | Drive + Docs/Sheets/Slides + collab suite |
| `epic-media-manager` | epic | docs/todo.md | pending | | audio/video/image media managers v0 |
| `epic-forms-manager` | epic | docs/todo.md | pending | | forms_manager + notify/events |
| `epic-integrations-manager` | epic | docs/todo.md | pending | | custom integrations + event triggers |
| `epic-ui-system-nav` | epic | docs/todo.md | pending | | System nav, orbit home, envs, Icarus create envs |
| `epic-cicd-git-json` | epic | docs/todo.md | pending | | Easy git-repo CI/CD config story |
| `epic-agent-flows` | epic | docs/todo.md | pending | | System/project/custom flows + IaC |
| `epic-agents-manager` | epic | docs/todo.md | pending | | Agent builder SDK/UI/tool e2e/cron/tv-music |
| `epic-ai-manager-shop` | epic | docs/todo.md | pending | | AI ops shop + tool_call_manager |
| `epic-api-app-tdd` | epic | docs/todo.md | pending | | TV/Music api+app + tutorial-driven e2e |
| `epic-email-haraka` | epic | docs/todo.md | pending | | Haraka self-host + Gmail |

## Wave queue (seed)

1. **Wave 1:** mgr-auth_manager, mgr-key_manager, mgr-storage_manager, mgr-db_manager, mgr-secrets_manager, mgr-iam_manager, mgr-config_manager, mgr-queue_manager (+ ops-gate0 in orchestrator)
2. **Wave 2:** mgr-compute_manager, mgr-schedule_manager, mgr-network_manager, mgr-ai_manager, mgr-vector_manager, mgr-function_manager, mgr-workflow_manager, mgr-cluster_manager
3. **Wave 3:** mgr-git_manager, mgr-cicd_manager, mgr-api_manager, mgr-app_manager, mgr-registry_manager, mgr-mcp_manager, mgr-code_as_infra, mgr-websocket_manager
4. Continue remaining managers → cross-cuts → epics (scaffold slices)

**Catalog gap:** `notify_manager` not in GA_MATURITY — fix in its closeout.

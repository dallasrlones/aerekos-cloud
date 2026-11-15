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
| `mgr-ai_manager` | manager | `worker/ai_manager` | done | live LLM keys; OpenAPI parked | Wave 2 closeout ff2e6ed/7a2fdc1; 6 scoped tests |
| `mgr-analytics_manager` | manager | `worker/analytics_manager` | done | live e2e needs conductor | Wave 4 closeout 0611439/acb0871; 16 tests |
| `mgr-api_manager` | manager | `worker/api_manager` | done | live e2e needs conductor | Wave 3 closeout 282aff1/2063a5a; 12 tests |
| `mgr-app_manager` | manager | `worker/app_manager` | done | live e2e needs conductor | Wave 3 closeout d7d5eab; 12 tests |
| `mgr-audit_manager` | manager | `worker/audit_manager` | done | live e2e needs conductor | Wave 4 closeout 48003207 |
| `mgr-auth_manager` | manager | `worker/auth_manager` | done | | Wave 1 closeout 6c8054c; 13 tests |
| `mgr-backup_manager` | manager | `worker/backup_manager` | done | live e2e needs conductor | Wave 4 closeout 97a7281; 13 tests |
| `mgr-balancer_manager` | manager | `worker/balancer_manager` | done | live e2e needs conductor | Wave 4 closeout a0b2aa0c |
| `mgr-billing_manager` | manager | `worker/billing_manager` | done | live e2e needs conductor | Wave 4 closeout b9c4410; 11 tests |
| `mgr-cdn_manager` | manager | `worker/cdn_manager` | done | live e2e needs conductor | Wave 4 closeout f3dbf22e |
| `mgr-cert_manager` | manager | `worker/cert_manager` | done | live e2e needs conductor | Wave 4 closeout 8415d3e2 |
| `mgr-cicd_manager` | manager | `worker/cicd_manager` | done | live e2e needs conductor | Wave 3 closeout 0c06752 |
| `mgr-cluster_manager` | manager | `worker/cluster_manager` | done | live e2e needs conductor | Wave 2 closeout 0997d3b; 12 tests |
| `mgr-code_as_infra` | manager | `worker/code_as_infra` | done | live e2e needs conductor | Wave 3 closeout a44ee55; 9 tests |
| `mgr-compute_manager` | manager | `worker/compute_manager` | done | live e2e needs conductor | Wave 2 closeout 4a7d145/5d9396e; 49 tests |
| `mgr-config_manager` | manager | `worker/config_manager` | done | live e2e needs conductor | Wave 1 closeout d949915; 9 tests |
| `mgr-crawler_manager` | manager | `worker/crawler_manager` | done | live e2e / egress parked | Wave 4 closeout b7e447e; 11 tests |
| `mgr-db_manager` | manager | `worker/db_manager` | done | live e2e needs conductor | Wave 1 closeout 64d76dc; 61 tests |
| `mgr-domain_manager` | manager | `worker/domain_manager` | done | live e2e needs conductor; CF needs-keys | Wave 5 closeout; 15 tests (health+DNS CRUD+hostnames+prod-guard) |
| `mgr-download_manager` | manager | `worker/download_manager` | done | live e2e needs conductor; qbit/yt-dlp for live download | Wave 5 closeout 2f999412; 14 tests |
| `mgr-email_manager` | manager | `worker/email_manager` | done | live e2e / SMTP keys parked | Wave 5 closeout; health+CRUD+send+prod-guard tests |
| `mgr-event_manager` | manager | `worker/event_manager` | done | live e2e needs conductor | Wave 5 closeout; health+CRUD+events/rules+prod-guard tests |
| `mgr-function_manager` | manager | `worker/function_manager` | done | live e2e needs conductor | Wave 2 closeout 505b26d; 8 tests |
| `mgr-git_manager` | manager | `worker/git_manager` | done | live e2e / Smart HTTP parked | Wave 3 closeout 5ffea59; 20 tests |
| `mgr-graphql_manager` | manager | `worker/graphql_manager` | done | live e2e needs conductor + api_manager | Wave 5 closeout; health+CRUD+compile/execute+prod-guard tests |
| `mgr-host_manager` | manager | `worker/host_manager` | done | live e2e / sync needs conductor | Wave 5 closeout; health+CRUD+sync-guard tests |
| `mgr-iam_manager` | manager | `worker/iam_manager` | done | live e2e needs stack | Wave 1 closeout b51e1c4; 17 tests |
| `mgr-iot_manager` | manager | `worker/iot_manager` | done | live e2e needs conductor; MQTT broker parked | Wave 5 closeout 2ebdce5b; 11 tests |
| `mgr-key_manager` | manager | `worker/key_manager` | done | schedule_manager also 3102 | Wave 1 closeout c8f8c4f/83d68da; 55 tests |
| `mgr-logs_manager` | manager | `worker/logs_manager` | done | live e2e needs conductor | Wave 5 closeout 3cf7dab4; 20 tests |
| `mgr-mcp_manager` | manager | `worker/mcp_manager` | done | live e2e needs conductor | Wave 3 closeout 9f8575b |
| `mgr-metrics_manager` | manager | `worker/metrics_manager` | in_progress |  | Wave 6 |
| `mgr-network_manager` | manager | `worker/network_manager` | done | live e2e needs conductor | Wave 2 closeout 12ee759/870a48e; 12 tests |
| `mgr-notebook_manager` | manager | `worker/notebook_manager` | in_progress |  | Wave 6 |
| `mgr-notify_manager` | manager | `worker/notify_manager` | in_progress |  | Wave 6 |
| `mgr-push_manager` | manager | `worker/push_manager` | in_progress |  | Wave 6 |
| `mgr-query_manager` | manager | `worker/query_manager` | done | live e2e needs conductor | Wave 6 closeout 53c3c6fd; 13 tests |
| `mgr-queue_manager` | manager | `worker/queue_manager` | done | capacity-wait UI 404 parked | Wave 1 closeout ca059d1; 17 tests |
| `mgr-registry_manager` | manager | `worker/registry_manager` | done | live e2e needs conductor | Wave 3 closeout ef6dd9b; 12 tests |
| `mgr-schedule_manager` | manager | `worker/schedule_manager` | done | port 3102 collides with key_manager | Wave 2 closeout 7761122/8f07368; 9 tests |
| `mgr-search_manager` | manager | `worker/search_manager` | in_progress |  | Wave 6 |
| `mgr-secrets_manager` | manager | `worker/secrets_manager` | done | live proxy manual | Wave 1 closeout 09ee11a/cdfebab; 26 tests |
| `mgr-security_manager` | manager | `worker/security_manager` | in_progress |  | Wave 6 |
| `mgr-slack_manager` | manager | `worker/slack_manager` | in_progress |  | Wave 6 |
| `mgr-sms_manager` | manager | `worker/sms_manager` | pending | | closeout DoD |
| `mgr-status_manager` | manager | `worker/status_manager` | pending | | closeout DoD |
| `mgr-storage_manager` | manager | `worker/storage_manager` | done | live proxy manual | Wave 1 closeout 88291cb/234ffa2; 110 tests |
| `mgr-system_manager` | manager | `worker/system_manager` | pending | | closeout DoD |
| `mgr-trace_manager` | manager | `worker/trace_manager` | pending | | closeout DoD |
| `mgr-transfer_manager` | manager | `worker/transfer_manager` | pending | | closeout DoD |
| `mgr-tunnel_manager` | manager | `worker/tunnel_manager` | pending | | closeout DoD |
| `mgr-vector_manager` | manager | `worker/vector_manager` | done | live e2e needs conductor | Wave 2 closeout cbe5f91; 8 tests |
| `mgr-vpn_manager` | manager | `worker/vpn_manager` | pending | | closeout DoD |
| `mgr-waf_manager` | manager | `worker/waf_manager` | pending | | closeout DoD |
| `mgr-webhook_manager` | manager | `worker/webhook_manager` | pending | | closeout DoD |
| `mgr-websocket_manager` | manager | `worker/websocket_manager` | done | live WSS/proxy parked | Wave 3 closeout 270246c/16e2155; 10 tests |
| `mgr-worker_manager` | manager | `worker/worker_manager` | pending | | closeout DoD |
| `mgr-workflow_manager` | manager | `worker/workflow_manager` | done | live e2e needs conductor | Wave 2 closeout 28e53d2; 6+4 tests |

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
4. **Wave 4:** mgr-analytics_manager, mgr-audit_manager, mgr-backup_manager, mgr-balancer_manager, mgr-billing_manager, mgr-cdn_manager, mgr-cert_manager, mgr-crawler_manager
5. **Wave 5:** mgr-domain_manager, mgr-download_manager, mgr-email_manager, mgr-event_manager, mgr-graphql_manager, mgr-host_manager, mgr-iot_manager, mgr-logs_manager
4. Continue remaining managers → cross-cuts → epics (scaffold slices)

**Catalog gap:** `notify_manager` not in GA_MATURITY — fix in its closeout.

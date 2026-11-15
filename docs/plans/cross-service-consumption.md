# Cross-service consumption pass (Wave 9 · x-cross-service)

**Owner:** managers calling siblings via conductor (`/api/services/<peer>/…`)  
**Source intent:** “Cross Service Work Together” (product todo / wants — each service should use peers where sensible)  
**Shared helper:** [`worker/shared/conductorProxy.js`](../../worker/shared/conductorProxy.js)  
**Rule:** [`new_service.md`](../../new_service.md) — never call managers by host port; go through conductor  
**Audited:** 2026-11-15 · static scan of `worker/*_manager` / `code_as_infra` production code (excludes tests)

---

## Verdict

~**22 / 58** managers already invoke at least one sibling through the conductor proxy path.  
Many of the remaining 36 are **CRUD-only** (no peer needed yet) or call **conductor itself** (`/api/workers`, registration) rather than another manager.  
This wave ships **one** cheap wiring fix (`schedule_manager` → `queue_manager` via conductor) and parks the rest as next slices.

---

## Already wired (caller → siblings via `/api/services/…`)

| Caller | Sibling targets |
|--------|-----------------|
| `ai_manager` | `api_manager`, `db_manager`, `mcp_manager`, `queue_manager`, `search_manager`, `storage_manager` |
| `api_manager` | `db_manager`, `function_manager`, `graphql_manager`, `waf_manager` |
| `backup_manager` | `slack_manager` |
| `cicd_manager` | `compute_manager`, `git_manager` |
| `compute_manager` | `domain_manager`, `git_manager`, `logs_manager`, `metrics_manager`, `registry_manager`, `secrets_manager`, `storage_manager` |
| `db_manager` | `key_manager`, `storage_manager` |
| `download_manager` | `storage_manager` |
| `event_manager` | `iot_manager`, `queue_manager`, `websocket_manager` |
| `function_manager` | `compute_manager`, `queue_manager`, `storage_manager` |
| `git_manager` | `cicd_manager`, `queue_manager` |
| `graphql_manager` | `api_manager` |
| `iot_manager` | `websocket_manager` |
| `key_manager` | `storage_manager` |
| `mcp_manager` | `backup_manager`, `graphql_manager`, `search_manager` |
| `metrics_manager` | `event_manager` |
| `notebook_manager` | `compute_manager` |
| `secrets_manager` | `key_manager` |
| `storage_manager` | `db_manager`, `key_manager` |
| `system_manager` | `compute_manager` |
| `transfer_manager` | `storage_manager` |
| `vector_manager` | `ai_manager`, `db_manager` |
| `workflow_manager` | `function_manager`, `queue_manager` |
| `schedule_manager` | `queue_manager` (**Wave 9 fix** — was direct `QUEUE_MANAGER_URL` / localhost:3101) |

Conductor-only (not sibling managers, but related): `host_manager` / `worker_manager` sync via conductor `/api/workers`; log shipper → `logs_manager` via conductor (`worker/utils/startLogShipping.js`).

---

## No sibling `/api/services` calls found (scan)

`analytics_manager`, `app_manager`, `audit_manager`, `auth_manager`, `balancer_manager`, `billing_manager`, `cdn_manager`, `cert_manager`, `cluster_manager`, `code_as_infra`, `config_manager`, `crawler_manager`, `domain_manager`, `email_manager`, `host_manager`, `iam_manager`, `logs_manager`, `network_manager`, `notify_manager`, `push_manager`, `query_manager`, `queue_manager`, `registry_manager`, `search_manager`, `security_manager`, `slack_manager`, `sms_manager`, `status_manager`, `trace_manager`, `tunnel_manager`, `vpn_manager`, `waf_manager`, `webhook_manager`, `websocket_manager`, `worker_manager`

Many of these are intentional MVPs (local SQLite / provider APIs only).

---

## Obvious missing / weak edges (next slices — not this wave)

| Edge | Why it matters | Pointers / notes |
|------|----------------|------------------|
| `notify_manager` → email/sms/slack/push providers as peer managers | Unified notify still facade/local; Phase 2 merge | `worker/notify_manager/README.md`, `worker/shared/notifyFacade` |
| `audit_manager` ingest from peers | Other managers do not emit audit events yet | `worker/audit_manager/plan.md` “Cross-service emit helpers” |
| `email` / `sms` / `slack` / `push` → `secrets_manager` for provider keys | Still env/secrets-at-enable; not runtime peer fetch | per-manager READMEs |
| `status_manager` / `trace_manager` ← observe shippers | Only `compute_manager` ships logs/metrics today | `compute_manager/api/services/ObserveShipper.js` |
| `cicd_manager` direct `GIT_MANAGER_URL` / `AUTH_MANAGER_URL` fallbacks | Still has docker-network host defaults alongside conductor paths | `worker/cicd_manager/api/services/CicdPipelineService.js` |
| `balancer` / `cdn` / `cert` / `domain` / `tunnel` pairing | Edge pair is product-level; limited runtime sibling calls | domain + tunnel plans |
| Live stack proof of all edges | Needs conductor + enabled peers | per-manager `tests/e2e/README.md` |

---

## Wave 9 concrete improvement

**Fixed:** `schedule_manager` queue dispatch defaults to  
`{CONDUCTOR_URL}/api/services/queue_manager/api/v1/queues/:name/messages`  
(with auth headers from `conductorProxy.authHeaders`).  

**Removed:** silent `http://127.0.0.1:3101` default.  

**Escape hatch:** `QUEUE_MANAGER_URL` for tests/direct only.  

**Files:**  
- [`worker/schedule_manager/api/services/DispatchService.js`](../../worker/schedule_manager/api/services/DispatchService.js) (conductor URL + auth header mirror; avoids requiring `shared/conductorProxy` from this package’s axios root)  
- [`worker/schedule_manager/tests/integration/api.test.js`](../../worker/schedule_manager/tests/integration/api.test.js)  
- README / `.env_example` / [`docs/services/schedule_manager.md`](../services/schedule_manager.md)

---

## Next slices (remaining)

1. Migrate remaining `*_MANAGER_URL` direct defaults (e.g. cicd git/auth fallbacks) to conductor-first  
2. Wire `notify_manager` Phase 2 to legacy channel managers or absorb them  
3. Optional audit emit helper used by 1–2 hot paths  
4. Live e2e matrix for top edges (schedule→queue, transfer→storage, workflow→function/queue)

# SDK ↔ catalog ↔ worker manager coverage

**Wave 9 (`x-sdk`) audit.** Not a claim of full API parity — every manager is reachable via catalog-driven accessors; only a subset has rich typed helpers.

**Sources:** `docs/catalog.js` → `aerekos-sdk/managers.generated.js` · `worker/*_manager` · `aerekos-sdk/index.js`

---

## Honesty summary

| Layer | Count | Notes |
|-------|------:|-------|
| Worker manager packages | 58 | includes `code_as_infra` |
| Catalog / `MANAGERS` / `client.svc.*` | 58 | synced in Wave 9 (added `notify_manager`) |
| Rich typed helpers (`client.keys`, `client.notify`, …) | 24 managers | ergonomic methods; **not** full route coverage |
| Catalog-only (`client.svc.{name}` / `client.manager` / `client.resource`) | 34 | CRUD segment when catalog has one; else `.proxy()` |

**Do not claim full parity.** Typed helpers often cover a happy path (list/create/send) while managers expose extra actions (attach, scale, OpenAPI-only routes). Prefer OpenAPI + `proxy`/`call` for completeness.

---

## Access model

| Access | When to use |
|--------|-------------|
| `client.svc.<manager>` / `client.manager(name)` | Always available for catalog managers — `.info()`, `.metrics()`, `.resource(seg)`, `.proxy()` |
| `client.resource(name, segment)` | Uniform CRUD managers |
| Typed namespaces (`client.notify`, `client.download`, …) | High-traffic ergonomics; subset of routes |
| CLI `aerekos <manager> …` / `aerekos call` | Same catalog table as SDK |

---

## Wave 9 concrete fix

- **Gap closed:** `notify_manager` existed under `worker/` + seed but was missing from `docs/catalog.js` → `managers.generated.js` (SDK/CLI catalog).
- **Shipped:** catalog + ports + UI seed row + e2e + click-ops + regenerated `managers.generated.js` + typed `client.notify` + tests that fail if worker managers vanish from the SDK catalog or `client.svc` map.

---

## Coverage matrix

Legend: **typed** = dedicated helper class · **svc** = catalog accessor only · **partial** = typed helper exists but is thin / not full CRUD.

| Manager | Worker | Catalog / svc | Typed helper | Remaining gap |
|---------|:------:|:-------------:|--------------|---------------|
| `key_manager` | ✓ | ✓ | `keys` | rotate-only extras OK |
| `storage_manager` | ✓ | ✓ | `storage` | strong; not every signed-url edge |
| `db_manager` | ✓ | ✓ | `db` / `cache` | thin proxy + cache; not full RDS surface |
| `compute_manager` | ✓ | ✓ | `compute` | scale/remove only subset |
| `queue_manager` | ✓ | ✓ | `queue` | engines beyond standard |
| `schedule_manager` | ✓ | ✓ | svc | no typed helper |
| `network_manager` | ✓ | ✓ | svc | no typed helper |
| `logs_manager` | ✓ | ✓ | `logs` (thin) | thin proxy only |
| `metrics_manager` | ✓ | ✓ | svc | no typed helper |
| `security_manager` | ✓ | ✓ | svc | no typed helper |
| `analytics_manager` | ✓ | ✓ | svc | no typed helper |
| `iam_manager` | ✓ | ✓ | `iam` (partial) | evaluate only; policies via svc/resource |
| `secrets_manager` | ✓ | ✓ | `secrets` | — |
| `auth_manager` | ✓ | ✓ | `auth` / `users` (partial) | app token + users; provider CRUD via svc |
| `tunnel_manager` | ✓ | ✓ | svc | needs-keys |
| `domain_manager` | ✓ | ✓ | svc | needs-keys |
| `cdn_manager` | ✓ | ✓ | svc | no typed helper |
| `balancer_manager` | ✓ | ✓ | `balancer` | — |
| `webhook_manager` | ✓ | ✓ | svc | no typed helper |
| `email_manager` | ✓ | ✓ | svc | prefer `notify` long-term |
| `sms_manager` | ✓ | ✓ | svc | prefer `notify` long-term |
| `slack_manager` | ✓ | ✓ | svc | prefer `notify` long-term |
| `git_manager` | ✓ | ✓ | `git` (thin) | Smart HTTP via proxy |
| `registry_manager` | ✓ | ✓ | svc | no typed helper |
| `cicd_manager` | ✓ | ✓ | svc | no typed helper |
| `code_as_infra` | ✓ | ✓ | svc | experimental |
| `api_manager` | ✓ | ✓ | `data` | Data API focus; gateway CRUD via svc |
| `app_manager` | ✓ | ✓ | svc | no typed helper |
| `mcp_manager` | ✓ | ✓ | svc | no typed helper |
| `ai_manager` | ✓ | ✓ | `intelligence`/`llm`/`agents`/… | broad but not every agent route |
| `crawler_manager` | ✓ | ✓ | svc | needs-keys |
| `host_manager` | ✓ | ✓ | svc | no typed helper |
| `worker_manager` | ✓ | ✓ | svc | no typed helper |
| `system_manager` | ✓ | ✓ | svc | no typed helper |
| `websocket_manager` | ✓ | ✓ | `realtime` (partial) | publish/connect helpers |
| `event_manager` | ✓ | ✓ | `events` (partial) | publish only |
| `download_manager` | ✓ | ✓ | `download` | strong |
| `backup_manager` | ✓ | ✓ | `backup` | — |
| `workflow_manager` | ✓ | ✓ | svc | no typed helper |
| `config_manager` | ✓ | ✓ | `config` | — |
| `cert_manager` | ✓ | ✓ | svc | no typed helper |
| `billing_manager` | ✓ | ✓ | svc | no typed helper |
| `function_manager` | ✓ | ✓ | `functions` | — |
| `iot_manager` | ✓ | ✓ | `iot` (partial) | publish only |
| `graphql_manager` | ✓ | ✓ | `graphql` | execute helper |
| `notebook_manager` | ✓ | ✓ | svc | no typed helper |
| `trace_manager` | ✓ | ✓ | `traces` (thin) | thin proxy |
| `search_manager` | ✓ | ✓ | `search` | query helper |
| `query_manager` | ✓ | ✓ | `query` | sql helper |
| `waf_manager` | ✓ | ✓ | svc | no typed helper |
| `vpn_manager` | ✓ | ✓ | svc | needs-keys |
| `transfer_manager` | ✓ | ✓ | svc | no typed helper |
| `audit_manager` | ✓ | ✓ | svc | no typed helper |
| `status_manager` | ✓ | ✓ | svc | no typed helper |
| `cluster_manager` | ✓ | ✓ | svc | no typed helper |
| `vector_manager` | ✓ | ✓ | svc | no typed helper |
| `push_manager` | ✓ | ✓ | `push` (partial) | send/try; prefer `notify` |
| `notify_manager` | ✓ | ✓ | `notify` | **Wave 9 added** to catalog + typed helper |

---

## Guardrails (tests)

In `aerekos-sdk/tests/client.test.js`:

1. Every `MANAGERS` entry has `client.svc[name]` and `client.manager(name)`.
2. Every `worker/*_manager` (and `code_as_infra`) directory appears in `MANAGERS`.

These fail CI/local SDK tests if catalog sync drifts again.

---

## Out of scope / known non-manager noise

- Console UI catalog entry `adonis` (Icarus IDE) is not a worker manager — `scripts/check-catalog.mjs` still reports `UI vs catalog: adonis` (pre-existing; not an SDK accessor gap).
- OpenAPI-driven TypeScript types, shell completion, and full CLI parity remain Phase B/C in [aerekos_sdk.md](./aerekos_sdk.md).
- Live conductor e2e for most managers remains parked (manager-level closeouts).

---

## Links

- [aerekos_sdk.md](./aerekos_sdk.md)
- [aerekos-sdk/README.md](../../aerekos-sdk/README.md)
- [docs/catalog.js](../catalog.js)

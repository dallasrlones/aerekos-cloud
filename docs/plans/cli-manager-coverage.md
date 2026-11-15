# CLI ↔ catalog / manager coverage (Wave 9 · x-cli)

**Owner:** `aerekos-sdk/bin/aerekos.js` · catalog `docs/catalog.js` → `aerekos-sdk/managers.generated.js`  
**Related:** [aerekos_sdk.md](./aerekos_sdk.md) · enterprise E32 `cliParity`  
**Audited:** 2026-11-15 · **Verdict:** `cliParity` is **partial platform-wide** — not complete for any manager.

---

## How the CLI reaches managers today

| Path | Mechanism | Coverage |
|------|-----------|----------|
| Generic CRUD | `aerekos <mgr> <segment> list\|get\|create\|update\|delete` | All 57 catalog managers by name; segment must match manager routes |
| Default segment | `managers.generated.js` `segment` field | 42 managers have a default segment hint; CLI still requires the segment arg |
| Generic proxy | `aerekos call <mgr> <METHOD> <path>` | Escape hatch for non-CRUD routes |
| Discover | `managers`, `info`, `metrics`, `services`, `workers` | Catalog table + live conductor |
| Health | `aerekos health [service] [-P project]` | One service or all registered (Wave 9 closeout) |
| Specialized verbs | `backup`, `iac`, `setup`, `edge`, `vpc`, `systems`, `graphql`, `search`, `intelligence`, `agents`, `connectors` | Conductor / cross-cut flows — not 1:1 per manager OpenAPI |

SDK helpers such as `client.keys`, `client.users`, `client.invoke` are **not** mirrored as first-class CLI verbs (use `call` / CRUD / planned `cred`·`token`·`invoke`).

---

## Global / plan gaps (vs aerekos_sdk.md target map)

| Target verb | Status | Notes |
|-------------|--------|-------|
| `login` / `logout` / `whoami` / `config` | **shipped** | Config show only; `config set` not implemented |
| `managers` / `services` / `workers` / `info` / `metrics` | **shipped** | |
| `call` | **shipped** | |
| `<mgr> <segment> CRUD` | **shipped** | Uniform contract only; custom actions need `call` |
| `health` | **shipped** (Wave 9) | Was documented as target; now wired to `services.health` |
| `setup` / `iac` / `backup` / `edge` / `vpc` / `systems` | **shipped** | HELP lagged some subcommands (parity fixed Wave 9) |
| `search` / `graphql` / `intelligence` / `agents` / `connectors` | **partial** | Subset of SDK surface |
| `cred` / `token` / `invoke` | **missing** | Blocked on platform app-access (Phase A) |
| `completion` / `wizard` / `e2e smoke` | **missing** | Phase C/D |
| `services enable\|disable` as verbs | **via `setup`** | `aerekos setup <service>` → setup enable; no `services enable` alias |
| Catalog `cliParity` field (E32) | **missing** | Not on `docs/catalog.js` rows yet |
| CI: `cliParity: complete` ⇒ help text | **missing** | Help verb smoke test only (this closeout) |

---

## Per-manager gap matrix

Legend for **CLI parity (honest)**:

- **partial** — reachable via generic CRUD using catalog/default segment (or documented segment); not full OpenAPI / console action parity
- **thin** — manager name is recognized, but no catalog `crud` / no generated default segment; operators must know path segments or use `call`
- **none** — would mean not in `MANAGERS` / not invocable; **does not apply** today (all 57 are named in the CLI)

| manager | catalog status | default segment | catalog `crud` | CLI parity | Primary CLI path |
|---------|----------------|-----------------|----------------|------------|------------------|
| key_manager | implemented | — | no | thin | `call` / invent segment (SDK `keys` helper unused by CLI) |
| storage_manager | implemented | — | no | thin | `call` |
| db_manager | implemented | — | no | thin | `call` |
| compute_manager | implemented | — | no | thin | `call` |
| queue_manager | implemented | — | no | thin | `call` |
| schedule_manager | implemented | — | no | thin | `call` |
| network_manager | implemented | — | no | thin | `call` |
| logs_manager | implemented | — | no | thin | `call` |
| metrics_manager | implemented | series | yes | partial | `metrics_manager series …` |
| security_manager | implemented | findings | yes | partial | `security_manager findings …` |
| analytics_manager | implemented | events | yes | partial | `analytics_manager events …` |
| iam_manager | implemented | — | no | thin | `call` |
| secrets_manager | implemented | — | no | thin | `call` |
| auth_manager | implemented | providers | no | partial | `auth_manager providers …` or `call` (users via SDK only) |
| tunnel_manager | needs-keys | — | no | thin | `call` |
| domain_manager | needs-keys | — | no | thin | `call` |
| cdn_manager | implemented | rules | yes | partial | `cdn_manager rules …` |
| balancer_manager | implemented | targets | yes | partial | `balancer_manager targets …` |
| webhook_manager | implemented | — | no | thin | `call` |
| email_manager | needs-keys | messages | yes | partial | `email_manager messages …` |
| sms_manager | needs-keys | messages | yes | partial | `sms_manager messages …` |
| slack_manager | needs-keys | messages | yes | partial | `slack_manager messages …` |
| git_manager | implemented | — | no | thin | `call` (repos helpers not CLI verbs) |
| registry_manager | implemented | — | no | thin | `call` |
| cicd_manager | implemented | pipelines | yes | partial | `cicd_manager pipelines …` |
| code_as_infra | experimental | modules | yes | partial | `code_as_infra modules …` |
| api_manager | implemented | endpoints | yes | partial | `api_manager endpoints …` |
| app_manager | implemented | apps | yes | partial | `app_manager apps …` |
| mcp_manager | implemented | tools | yes | partial | `mcp_manager tools …` |
| ai_manager | needs-keys | intelligence | yes | partial | CRUD + `intelligence` / `agents` verbs; no `invoke` |
| crawler_manager | needs-keys | jobs | yes | partial | `crawler_manager jobs …` |
| host_manager | implemented | hosts | yes | partial | `host_manager hosts …` |
| worker_manager | implemented | annotations | yes | partial | `worker_manager annotations …` |
| system_manager | implemented | tasks | yes | partial | `system_manager tasks …` |
| websocket_manager | implemented | channels | yes | partial | `websocket_manager channels …` |
| event_manager | implemented | buses | yes | partial | `event_manager buses …` |
| download_manager | implemented | lists | yes | partial | `download_manager lists …` |
| backup_manager | implemented | vaults | yes | partial | CRUD + `backup` conductor verb |
| workflow_manager | implemented | machines | yes | partial | `workflow_manager machines …` |
| config_manager | implemented | namespaces | yes | partial | `config_manager namespaces …` |
| cert_manager | implemented | certs | yes | partial | `cert_manager certs …` |
| billing_manager | implemented | meters | yes | partial | `billing_manager meters …` |
| function_manager | implemented | functions | yes | partial | `function_manager functions …` |
| iot_manager | implemented | things | yes | partial | `iot_manager things …` |
| graphql_manager | implemented | apis | yes | partial | CRUD + `graphql execute` |
| notebook_manager | implemented | notebooks | yes | partial | `notebook_manager notebooks …` |
| trace_manager | implemented | traces | yes | partial | `trace_manager traces …` |
| search_manager | implemented | indexes | yes | partial | CRUD + `search query` |
| query_manager | implemented | queries | yes | partial | `query_manager queries …` |
| waf_manager | implemented | rules | yes | partial | `waf_manager rules …` |
| vpn_manager | implemented | peers | yes | partial | `vpn_manager peers …` |
| transfer_manager | implemented | endpoints | yes | partial | `transfer_manager endpoints …` |
| audit_manager | implemented | events | yes | partial | `audit_manager events …` |
| status_manager | implemented | incidents | yes | partial | `status_manager incidents …` |
| cluster_manager | implemented | clusters | yes | partial | `cluster_manager clusters …` |
| vector_manager | implemented | indexes | yes | partial | `vector_manager indexes …` |
| push_manager | needs-keys | subscriptions | yes | partial | `push_manager subscriptions …` |

**Counts:** 57 managers · **0** `complete` · **~42** `partial` · **~15** `thin` · catalog `cliParity` field **not shipped**.

---

## Honest notes on incomplete `cliParity`

1. **E32 is unchecked.** No manager row in `docs/catalog.js` carries `cliParity: complete | partial | none`. This matrix is the interim source of truth.
2. **Generic CRUD ≠ console parity.** Console actions (test endpoint, rotate, sync, Smart HTTP, LLM chat, etc.) are not generated as CLI subcommands; only list/get/create/update/delete (+ `call`).
3. **Thin core managers** (key/storage/db/compute/queue/…) are first-class in the product but second-class in the CLI — SDK typed helpers exist; CLI expects `call` or tribal segment knowledge.
4. **App-developer path missing.** `cred` / `token` / `invoke` remain plan-only; without them, CLI cannot claim app-access parity.
5. **HELP historically drifted** from implemented subcommands (`iac` extras, `agents` extras, `connectors create`). Wave 9 adds a help-verb smoke test so Discover/Operate verbs stay listed.
6. **Do not mark any manager `cliParity: complete`** until catalog fields exist, non-CRUD actions are mapped or explicitly waived, and CI enforces help/coverage.

---

## Wave 9 closeout deliverables

- This gap matrix
- `aerekos health` command + HELP Operate line
- HELP parity for shipped `iac` / `agents` / `connectors` subcommands
- `aerekos-sdk/tests/cli-help.test.js` — `--help` lists expected verbs
- Pointer + honesty section in [aerekos_sdk.md](./aerekos_sdk.md)

# Icarus live e2e (C1–C8 + T65)

C0 is [icarus-c0.md](icarus-c0.md). These scripts live in `e2e/` and share `e2e/lib/icarusLive.js`.

Icarus tickets: T26, T27, T34, T39, T40, T43, T44, T65 — all **verified** when last run against the public conductor (`AEREKOS_API_URL` from Icarus `.env`).

## Shared env

Load Icarus `.env` on the Mac (do not commit, do not paste secrets):

| Variable | Role |
|----------|------|
| `AEREKOS_API_URL` | Public conductor (Icarus `.env.example`; never a private IP) |
| `AEREKOS_PROJECT_ID` | App project |
| `AEREKOS_CLIENT_ID` / `AEREKOS_CLIENT_SECRET` | App creds → `mintAppToken` |
| `AEREKOS_C0_ADMIN_TOKEN` or `TOKEN` | Optional pre-minted admin JWT; else scripts login |
| `ICARUS_C0_SKIP_LIVE=1` | Skip live calls (exit 0) |

Admin login for scripts that mint their own JWT uses the conductor console user (homelab default is local-only; rotate it).

```bash
set -a; . /path/to/icarus-agent/.env; set +a
unset ICARUS_C0_SKIP_LIVE
node e2e/<script>.js
```

Helper: `adminToken()`, `mintAppToken(admin, projectId)`, `request(method, path, { token, query, body })`.

## Matrix

| Ticket | File | Method / path (via conductor) | Notes |
|--------|------|-------------------------------|-------|
| T26 C1 | `memory-scopes.js` | memory ingest, search, delete session | Setup needs `body.config.data_worker_id = 'local'` |
| T27 C2 | `memory-hybrid.js` | ingest, promote, hybrid retrieve | Same memory fallback as C0 |
| T34 C3 | `llm-vision.js` | `POST .../llm/chat` with image | `AEREKOS_VISION_MODEL` (e.g. `gemma3:4b-it-qat`); 1×1 PNG fixture |
| T39 C4 | `db-rds.js` | `POST/GET .../db_manager/api/databases` | **sqlite3**. `project_id` query param only — **omit from JSON body** or Joi 400 |
| T40 C5+C6 | `lora-train.js`, `lora-attach.js` | `POST .../ai_manager/api/v1/lora/train` and `/attach` | Returns 201 immediately (`queued`). GPU sidecar trains later — [lora-gpu.md](lora-gpu.md) |
| T43 C7 | `oauth-identity.js` | auth_manager OIDC providers create+list | Do not rebuild auth_manager from Mac |
| T44 C8 | `gateway-presets.js` | `POST .../api_manager/api/v1/endpoints/seed-presets` | Preset scopes stuffed in `backend_url` (`service:path#scope`) |
| T65 | `worker-env-tags.js` | conductor worker register/list | `GET /api/token` (admin JWT) for **registration** token; unique IPs; `env` string + `capabilities[]` |
| Talk path | `icarus-talk-graph.js` | hey chat + do-work + `POST /api/live` for `ai:icarus.*` | Sacred CHAT/MANAGER path; LiveRoom allowlist regression |
| Agents | `icarus-agents.js` | setup, chat, interrupt, connectors | Friend agent smoke |
| Friends share (GA) | `friends-share.js` | invite (+email) → accept → outsider 403 → viewer write denial → leave → clear; `ai:friend.presence` | Needs admin JWT; creates temp users via `POST /api/auth/users` |
| Friends federation (Preview) | `friends-federation.js` | loopback peer → mint grant → attach → status → proxy project | Optional `SECOND_CONDUCTOR_URL`; rebuild conductor image for new routes |

## db_manager (T39)

`docker-compose.core.yml` service `db_manager` `:3004`. Listens when `AUTH_REQUIRED` is not true even if `PROJECT_ID` is unset. Auth middleware accepts app tokens. Engine `sqlite3` / `lancedb` in the create schema.

## Laya + Flows + platform tools + Part I matrix

| Check | Script | Notes |
|-------|--------|-------|
| Laya packs / predict / services map | `e2e/icarus-laya-flows.js` | Live `POST .../icarus/laya/predict` — real ai_manager |
| Generated tool matrix (files) | `e2e/platform-tools-matrix.js` | After `make docs` / `gen-platform-tools.mjs` |
| **Part I live matrix** | `e2e/icarus-platform-matrix.js` | Laya flow_pick/intake_next/lane, services map, `ai:ide.file` LiveRoom, agents — **non-prod only** |
| **Wants W1–W4** | `e2e/icarus-wants-matrix.js` | Info verify + CorpusStore, nav catalog, safe deps dry-run, workload reconcile — offline with `ICARUS_C0_SKIP_LIVE=1` |

### Part I acceptance rows (ship-blocking when live)

1. **Laya** — `flow_pick`, `intake_next`, lane, HITL risk, `config_vs_code` (live predict; heuristic fallback unit-tested)
2. **Guided Flows** — multi-turn ASK → confirm → stack apply (`new_project_app`, `new_worker_fleet`)
3. **IaC/OOTB** — stack put/diff/apply → Data API / tunnel health; rollback path
4. **Queue workers** — queue + consumer live
5. **Layer spine** — chat → manager tool loop → spawn → bubble `report_user`
6. **PR path** — branch + `open_pr` → `approve_pr` → user Merge; worker self-approve denied
7. **safe_self_update** — spawn claim + PR + health fail → rollback
8. **STEER / Neo4j** — steer mutates plan + wakes manager
9. **RAG/info** — info lane knowledge without manager wake
10. **HITL** — mutate without ASK fails; prod UUID hard-deny
11. **Icarus IDE** — live buffer (`ai:ide.file`), follow, conflict, PR dock, stack apply, services map
12. **Platform tools** — generated matrix + live SDK/status
13. **Resume/heal** — Computer/browser down ASK → heal → resume
14. **Docs drift** — `make docs` clean + SDK/catalog smoke

```bash
node e2e/platform-tools-matrix.js
node e2e/icarus-laya-flows.js
node e2e/icarus-platform-matrix.js
ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-wants-matrix.js   # offline W1–W4
make e2e-icarus-wants                                    # same via Makefile
```

Ship criterion: live LLM jobs must **complete**, not only enqueue. Non-prod project only. If brain down, heal/resume then re-run — do not skip GPU for ship.

## api_manager (T44)

`:3124`. Route `seed-presets` is registered **before** `/:id`. Model has no scopes column — encode in `backend_url`.

## Vision (T34)

Ollama must have the vision tag. Chat payload includes an image (tiny PNG). `ai_manager` Ollama adapter must not forward Icarus `project_id`/`resource` fields.

## Workers (T65)

Human JWT ≠ registration token. `GET /api/token` with admin JWT, then register with `env` + `capabilities`. Conductor migrates `ALTER TABLE workers ADD COLUMN env/capabilities` (ignore if exists).

## Memory fallback (T26/T27)

If `Record.registerMemoryModels` / `connectLance` are missing, `MemoryDbClient` uses sqlite DDL + in-memory vectors. `st_chunks` needs `importance` and `source_message_ids`. Volume: `aerekos-ai_ai_manager-data`. Env: `MEMORY_DB_FALLBACK=1`.

## Order vs C0

Run C0 first if `ai_manager` was recreated (LLM provider + memory setup). T40 GPU completion is **not** required for the JS e2e (it only asserts 201 + adapter id).

## Friends / federation image deploy checklist

1. Rebuild **conductor** image (federation + friends routes are baked — not hot-mounted API).
2. `docker compose -f docker-compose.core.yml up -d conductor` (or stack equivalent).
3. Confirm `GET /api/federation/peer` returns `maturity: preview` and `GET /api/projects/:id/members` returns `maturity: ga`.
4. Frontend is host bind-mount — refresh UI for Friends → Local | Federation tabs.
5. Loopback smoke: `node e2e/friends-share.js` then `node e2e/friends-federation.js` with `CONDUCTOR_URL` set.

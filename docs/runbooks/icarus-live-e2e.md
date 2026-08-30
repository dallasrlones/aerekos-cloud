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

## db_manager (T39)

`docker-compose.core.yml` service `db_manager` `:3004`. Listens when `AUTH_REQUIRED` is not true even if `PROJECT_ID` is unset. Auth middleware accepts app tokens. Engine `sqlite3` / `lancedb` in the create schema.

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

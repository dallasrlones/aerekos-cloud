# Icarus C0 — aerekos-cloud fleet smoke

Icarus **agents** are part of aerekos-cloud (AI Manager → Agents). C0 confirms LLM, embeddings, memory, secrets, and object storage, and that **proxy timeouts can outlast a local generate**. Named teammates use queued intelligence jobs, not a sister process. See [icarus-agents.md](icarus-agents.md).

Icarus-side map: `icarus-agent/docs/cloud.md`. Mixed-stack networking/auth: [mixed-stack.md](mixed-stack.md). Later tickets: [icarus-live-e2e.md](icarus-live-e2e.md).

## Timeouts (non-negotiable)

Queued intelligence (`execution: queued`) is the Cloudflare-safe path: `POST /intelligence/jobs` then poll `GET /jobs/:id`. Sync `POST /intelligence/chat` on a queued endpoint is **409**. Do not hold CF for the GPU.

Local vLLM/Ollama on Jetson Orin can sit silent for **minutes**. SaaS 60s/120s defaults will kill Icarus.

Icarus sets `LLM_INFERENCE_TIMEOUT_MS` (example **1800000** = 30 minutes). Every hop in front of generate/chat must be **≥ that value**:

| Layer | Variable | Default in this repo |
|-------|----------|----------------------|
| Icarus client | `LLM_INFERENCE_TIMEOUT_MS` | required in Icarus `.env` (no src default) |
| Conductor → worker proxy | `CONDUCTOR_PROXY_TIMEOUT_MS` | **1800000** |
| Ollama backend | `OLLAMA_REQUEST_TIMEOUT_MS` | **1800000** |
| vLLM backend | `VLLM_REQUEST_TIMEOUT_MS` | **1800000** |
| Conductor UI axios | `EXPO_PUBLIC_API_TIMEOUT_MS` | **1800000** |

**Rule: conductor / ai_manager / reverse-proxy timeout ≥ Icarus inference timeout.**

If you raise Icarus to 45 minutes, raise these four to match. Do not leave nginx/`proxy_read_timeout` at 60s in front of `/api/services/ai_manager/api/v1/llm/*`.

Embeddings and memory go through the **slow** conductor timeout (same as chat), not the 10s default. Otherwise embed returns **503**.

## URLs for Icarus `.env`

Point Icarus at the **public** conductor (any network):

```env
AEREKOS_API_URL=https://cloudapi.aerekos.com
AEREKOS_PROJECT_ID=<uuid from C0 or console>
AEREKOS_CLIENT_ID=<app credential>
AEREKOS_CLIENT_SECRET=<app secret>
AEREKOS_LLM_ARN=arn:aerekos:<project>:ai:llm:endpoint/<name>
AEREKOS_STORAGE_PROJECT_ID=<storage project uuid>
AEREKOS_STORAGE_BUCKET=icarus-chat
```

Never a private IP or localhost. `.env.example` in icarus-agent uses this origin.

Paths (all via conductor proxy):

| Capability | Method | Path |
|------------|--------|------|
| Token | POST | `/api/services/auth_manager/api/v1/auth/token?project_id=` |
| Chat | POST | `/api/services/ai_manager/api/v1/llm/chat` |
| Embed | POST | `/api/services/ai_manager/api/v1/embeddings` |
| Memory setup | POST | `/api/services/ai_manager/api/v1/memory/setup` |
| Memory search | POST | `/api/services/ai_manager/api/v1/memory/search` |
| Secrets list | GET | `/api/services/secrets_manager/api/v1/secrets` |
| Storage put | POST | `/api/services/storage_manager/api/projects/:id/buckets/:bucket/files/:key` |
| Storage get | GET | same path |

App credential scopes for Icarus: `ai:InvokeLlm`, `ai:InvokeEmbeddings`, `ai:InvokeMemory`, `ai:AdminMemory`, `secrets:List`, `storage:PutObject`, `storage:GetObject`, `storage:ListBucket`.

## Two tokens

| Token | How | Use |
|-------|-----|-----|
| Admin JWT | `POST /api/auth/login` `{ username, password }` (homelab console; do not paste into git) | Create project, app client, some admin routes. **Not** enough for secrets list / storage objects through `appProxyAuth`. |
| App token | `POST /api/services/auth_manager/api/v1/auth/token?project_id=` client_credentials | LLM, embed, memory, secrets, storage files |

C0 mints an app token after admin creates the project + client. Storage **projects/buckets** that C0 creates for put/get must be created **with the app token**, not the admin JWT.

`e2e/lib/icarusLive.js` `mintAppToken()` uses `AEREKOS_CLIENT_ID` / `SECRET` / `PROJECT_ID` from env.

## Storage put

- Content-Type: **`application/octet-stream`** or multipart. Not JSON `{content}` and not `text/plain`.
- Conductor streams the request body (`conductor/api/routes/services.js`). JSON parser must not consume it.
- storage_manager auth accepts conductor service tokens **and** auth_manager app JWTs.
- Host `:3002` is not necessarily this stack’s key_manager — conductor must talk to `aerekos-key_manager` on the **core** Docker network ([mixed-stack.md](mixed-stack.md)).

## LLM ARN

`AEREKOS_LLM_ARN` pins an endpoint name (e.g. `orin-ollama`). Recreating `ai_manager` **without** the named volume wipes sqlite and the endpoint. Then chat/embed 404/503.

- C0: `unset AEREKOS_LLM_ARN` so admin can create a fresh LLM resource, **or**
- Re-seed: `POST /api/services/ai_manager/api/v1/providers/seed-local?project_id=$PID` with the **app** token, then set ARN to `arn:aerekos:<project>:ai:llm:endpoint/orin-ollama`.

Keep volume `aerekos-ai_ai_manager-data`. `MEMORY_DB_FALLBACK=1` on `worker/docker-compose.ai.yml` lets memory run if Lance/register hooks are missing.

Memory **setup** e2e must send `body.config` with `data_worker_id: 'local'`. A bare setup overwrites config and leaves stores not ready.

Ollama chat: `ai_manager` strips `project_id` / `resource` before forwarding to Ollama (`model`, `messages`, `options`, `format`, `keep_alive` only).

## Run the smoke

From a machine on **any** network, with Icarus `.env` loaded (`AEREKOS_API_URL` = public conductor):

```bash
set -a
. /path/to/icarus-agent/.env
set +a
unset ICARUS_C0_SKIP_LIVE
# optional: unset AEREKOS_LLM_ARN   # if the named endpoint is gone

export TOKEN="$(
  node -e '
    const http=require("http");
    const u=new URL("/api/auth/login", process.env.AEREKOS_API_URL+"/");
    const body=Buffer.from(JSON.stringify({username:"admin",password:"admin"}));
    const req=http.request(u,{method:"POST",headers:{"Content-Type":"application/json","Content-Length":body.length}},res=>{
      let d=""; res.on("data",c=>d+=c); res.on("end",()=>process.stdout.write(JSON.parse(d).token||""));
    });
    req.write(body); req.end();
  '
)"

node e2e/icarus-c0-smoke.js
```

Do not print or commit `TOKEN`. Homelab login is the console user in device `.env` — rotate it; this snippet is the local default only.

Docs-only (CI without fleet):

```bash
ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-c0-smoke.js
```

Live DoD: token, chat, embed, memory, secrets list, put+get a tiny file. Script: `e2e/icarus-c0-smoke.js`.

## Failure cheat sheet

| Symptom | Likely cause |
|---------|----------------|
| secrets 401 | Generic proxy still on human JWT — need `appProxyAuth` in `routes/services.js` |
| secrets/storage 503, `host.docker.internal` ENOTFOUND | Conductor missing `extra_hosts` / not on core network — recreate conductor |
| embed 503, no healthy `ai_manager` | Worker down, or proxy 10s timeout, or ARN missing after sqlite wipe |
| storage put 401 | storage_manager only accepted conductor service tokens — needs auth_manager `verify()` |
| storage put 400 | Wrong Content-Type (must be octet-stream/multipart) |
| bucket 404 | key_manager not the core-network instance |
| chat 503 after ai_manager recreate | Re-seed `orin-ollama` or unset ARN |

Do not rebuild auth_manager from Mac unless `/api/v1/auth/token` is present in that tree.

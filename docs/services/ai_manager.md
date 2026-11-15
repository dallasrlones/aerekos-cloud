# ai_manager — Bedrock

> **AI** · Implemented · needs provider keys/URLs for live inference

Icarus console (`/icarus`): talk + live plan graph, Fleet, Models, Apps. GPU engines, intelligence jobs, agents, connectors. WS `ai:live` + `ai:icarus.*` + `ai:agent.*`.

- **Port:** `3126`
- **AWS analog:** Bedrock
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/ai_manager{path}` (JWT or service token)
- **Capabilities:** `ai`, `intelligence`, `stt`, `tts`, `agents`, `connectors`
- **OpenAPI:** none checked in (large surface; catalog + worker README are sources of truth)
- **Mocks:** none in production paths — missing LLM/STT/TTS URLs fail closed (not a `MOCK_*` stub)
- **Health/proxy:** `/health` + `/ready` skip `projectId` in conductor `proxyServiceRequest`; product routes need `project_id`

> ⚠️ **Provider activation:** LLM endpoint/URL + provider keys (e.g. Ollama URL) to run inference.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/intelligence` | Create a intelligence ({ project_id, name, ... }) |
| `GET` | `/api/v1/intelligence` | List intelligence (?project_id=) |
| `GET` | `/api/v1/intelligence/:id` | Get one intelligence |
| `PATCH` | `/api/v1/intelligence/:id` | Update a intelligence |
| `DELETE` | `/api/v1/intelligence/:id` | Delete a intelligence |
| `CRUD` | `/api/v1/models` | Model routing config |
| `GET` | `/api/v1/icarus/plans` | List Icarus plan graphs for a project |
| `GET` | `/api/v1/icarus/plans/:planId` | Get one plan |
| `GET` | `/api/v1/icarus/plans/:planId/scrub` | Time-travel subgraph scrub |
| `GET` | `/api/v1/icarus/ready` | Ready tasks for a plan |
| `GET` | `/api/v1/icarus/tasks/:taskId/trace` | Task tools + why/trace |
| `GET` | `/api/v1/icarus/status` | Icarus graph/runtime status |
| `GET` | `/api/v1/engines` | Fleet AI engine placements + catalog |
| `GET` | `/api/v1/engines/catalog` | Placeable engine kinds (vLLM, STT, Kokoro, XTTS, Ollama, cache) |
| `POST` | `/api/v1/engines` | Place { kind, worker_id } on a GPU worker (no auto-start for vLLM/XTTS/Ollama) |
| `POST` | `/api/v1/engines/:id/start` | Start a placed engine |
| `POST` | `/api/v1/engines/:id/stop` | Stop a placed engine |
| `POST` | `/api/v1/intelligence/jobs` | Submit a queued intelligence job |
| `GET` | `/api/v1/intelligence/jobs` | List jobs |
| `GET` | `/api/v1/intelligence/jobs/:id` | Get job snapshot (partial/result) |
| `POST` | `/api/v1/intelligence/jobs/:id/cancel` | Cancel a queued or running job |
| `GET` | `/api/v1/agents/setup/status` | Icarus fabric probe (Orin AI, prod-mini computer) |
| `POST` | `/api/v1/agents/setup` | Idempotent agent setup (intelligence, memory, RAG, settings) |
| `GET` | `/api/v1/agents/settings` | Project agent settings (concurrency, jail, write policy) |
| `PATCH` | `/api/v1/agents/settings` | Update project agent settings |
| `GET` | `/api/v1/agents/fleet` | Live fleet canvas snapshot |
| `POST` | `/api/v1/agents/resume` | Boot resume: heal, due crons (late labeled), learn jobs, workers, idle last |
| `POST` | `/api/v1/agents` | Create a named Icarus agent (ARN ai:agent:endpoint/name) |
| `GET` | `/api/v1/agents` | List agents |
| `GET` | `/api/v1/agents/:id` | Get agent by id or name |
| `PATCH` | `/api/v1/agents/:id` | Update agent knobs (mode, binds, timezone, notify) |
| `DELETE` | `/api/v1/agents/:id` | Delete agent |
| `POST` | `/api/v1/agents/:id/chat` | User-layer chat → queued intelligence job |
| `POST` | `/api/v1/agents/:id/voice` | Optional STT→chat→TTS compose |
| `POST` | `/api/v1/connectors/invoke` | Invoke a connector tool (ASK if needs_auth) |

Full agent/connector path list lives in `docs/catalog.js` and the worker README — Wave 2 honesty keeps the high-traffic surface here without regenerating the entire catalog table.

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3126` | Listen port |
| `CONDUCTOR_URL` | (unset) | Auto-register; skip with `SKIP_SERVICE_REGISTRATION=true` |
| `OLLAMA_HOST` / `VLLM_HOST` / `LLM_BACKEND` | (unset) | Live inference backends |
| `MEMORY_DB_FALLBACK` | (homelab often `1`) | sqlite memory when Lance hooks missing |

## SDK / CLI

SDK: `client.intelligence.*`, `client.stt.*`, `client.tts.*`, `client.agents.*`, `client.connectors.*`.

**SDK (Node)**

```js
await client.intelligence.create(PID, { name: 'demo' });
console.log(await client.intelligence.list(PID));
// Live chat needs LLM URL/keys:
// await client.intelligence.chat(PID, { messages: [{ role: 'user', content: 'hi' }] });
```

**CLI**

```bash
aerekos intelligence submit --project $PID --data '{"messages":[{"role":"user","content":"hi"}]}'
aerekos call ai_manager POST "/api/v1/intelligence" --project $PID \
  --data '{"project_id":"'"$PID"'","name":"demo"}'
```

No dedicated `aerekos ai_manager …` CRUD verb — use SDK, `aerekos call`, or `aerekos intelligence submit|job|wait|cancel`.

## Tutorial / ServiceGuide

- **Guide:** [`docs/guides/icarus.md`](../guides/icarus.md)
- **Console:** `/icarus` + in-console guides
- **Standalone `docs/tutorials` tutorial:** none

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/ai_manager/api/v1/intelligence?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

---

_Honesty pass for `mgr-ai_manager` Wave 2. Catalog endpoints remain in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

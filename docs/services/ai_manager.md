# ai_manager — Bedrock

> **AI** · Implemented · needs provider keys for live calls

Place GPU engines; intelligence jobs; Icarus shop (user layer / manager / workers) and dynamic connectors. Poll + WS ai:live, ai:agent.ask, ai:agent.pulse, ai:agent.done.

- **Port:** `3126`
- **AWS analog:** Bedrock
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/ai_manager{path}` (JWT or service token)
- **Capabilities:** `ai`, `intelligence`, `stt`, `tts`, `agents`, `connectors`

> ⚠️ **Provider activation:** LLM endpoint/URL + provider keys (e.g. Ollama URL) to run inference.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/intelligence` | Create a intelligence ({ project_id, name, ... }) |
| `GET` | `/api/v1/intelligence` | List intelligence (?project_id=) |
| `GET` | `/api/v1/intelligence/:id` | Get one intelligence |
| `PATCH` | `/api/v1/intelligence/:id` | Update a intelligence |
| `DELETE` | `/api/v1/intelligence/:id` | Delete a intelligence |
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
| `POST` | `/api/v1/agents/:id/interrupt` | Stop or add context mid-flight |
| `POST` | `/api/v1/agents/:id/approve` | Answer an ASK card |
| `GET` | `/api/v1/agents/:id/pulse` | Manager pulse + gateway snapshot |
| `GET` | `/api/v1/agents/:id/messages` | Chat history |
| `GET` | `/api/v1/agents/:id/pins` | Friend memory pins |
| `POST` | `/api/v1/agents/:id/pins` | Pin a durable fact |
| `DELETE` | `/api/v1/agents/:id/pins/:key` | Forget a pin |
| `GET` | `/api/v1/agents/:id/memory/export` | Export pins, rolls, messages |
| `POST` | `/api/v1/agents/:id/memory/wipe` | Wipe friend memory for this agent |
| `GET` | `/api/v1/agents/:id/rolls` | Temporal rolls (today/week/month/year) |
| `POST` | `/api/v1/agents/:id/rolls/refresh` | Rebuild temporal rolls |
| `GET` | `/api/v1/agents/:id/work` | Goal/Task/Subtask graph |
| `POST` | `/api/v1/agents/:id/work` | Create a work item |
| `PATCH` | `/api/v1/agents/:id/work/:workId` | Update work priority/status |
| `POST` | `/api/v1/agents/:id/work/reorder` | Reorder work ids now→later |
| `GET` | `/api/v1/agents/:id/prompts` | Get effective + override prompts |
| `PATCH` | `/api/v1/agents/:id/prompts` | Patch per-agent prompt overrides |
| `POST` | `/api/v1/agents/:id/prompts/reset` | Reset prompts to bundled defaults |
| `GET` | `/api/v1/agents/:id/browser/frames/:frameId` | JPEG screenshot for a browse ASK |
| `GET` | `/api/v1/agents/:id/prs/:id/diff` | Local PR diff (capped) |
| `GET` | `/api/v1/agents/:id/asks` | Open and answered ASK cards (one open at a time) |
| `GET` | `/api/v1/agents/:id/timeline` | Shop timeline (chat, brief, ask, tool, replan, deploy) |
| `GET` | `/api/v1/agents/:id/workers` | Worker agents for this Icarus |
| `POST` | `/api/v1/agents/:id/workers` | Spawn a queued worker (handoff packet) |
| `POST` | `/api/v1/agents/:id/workers/:wid/run` | Run a worker tool loop |
| `GET` | `/api/v1/agents/:id/cron` | Routines |
| `POST` | `/api/v1/agents/:id/cron` | Create a cron/routine |
| `POST` | `/api/v1/agents/:id/cron/:cid/fire` | Fire a cron via runtime (user_turn / idle_review / shop plan) |
| `GET` | `/api/v1/agents/:id/skills` | Skill templates |
| `POST` | `/api/v1/agents/:id/skills` | Create a skill |
| `GET` | `/api/v1/agents/:id/audit` | Tool and connector audit (no secrets) |
| `GET` | `/api/v1/agents/:id/fs` | List or read workspace files (jail) |
| `POST` | `/api/v1/agents/:id/fs` | Write a workspace file (ASK) |
| `POST` | `/api/v1/agents/:id/term` | Run a workspace command (ASK if mutating) |
| `POST` | `/api/v1/agents/:id/tools` | Execute a workspace tool (ASK on writes) |
| `POST` | `/api/v1/agents/:id/claim` | Claim a worktree prefix |
| `POST` | `/api/v1/agents/:id/message` | Inter-agent message |
| `POST` | `/api/v1/agents/:id/compact` | Queued compact job (never pins/ASK/DoD) |
| `GET` | `/api/v1/connectors/kinds` | Dynamic connector kind catalog |
| `POST` | `/api/v1/connectors` | Create a connector account (ARN connector:account/name) |
| `GET` | `/api/v1/connectors` | List project connectors |
| `GET` | `/api/v1/connectors/:id` | Get a connector |
| `PATCH` | `/api/v1/connectors/:id` | Update connector (secret_ref, OAuth reconnect) |
| `DELETE` | `/api/v1/connectors/:id` | Revoke a connector |
| `POST` | `/api/v1/connectors/invoke` | Invoke a connector tool (ASK if needs_auth) |

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

**SDK (Node)**

```js
const r = client.resource('ai_manager', 'intelligence');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos ai_manager intelligence create --project $PID --data '{"name":"demo"}'
aerekos ai_manager intelligence list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

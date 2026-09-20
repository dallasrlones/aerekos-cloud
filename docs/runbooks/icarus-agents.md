# Icarus agents

Named Icarus teammates live in **AI Manager → Agents**. They are part of aerekos-cloud, not a sister process.

## Console

- Direct: `https://cloud.aerekos.com/services/ai_manager/agents`
- Hub: `https://cloud.aerekos.com/services/ai_manager` → **Agents**
- System Home (System project): **GPU & AI → AI Manager**
- Other projects: Home → **AI Manager** if the service is enabled, or open the URL above
- Global search: type `AI Manager` or `Agents`

Do not confuse with [icarus.md](icarus.md) (the Cursor-replacement app) or [icarus-assistant.md](icarus-assistant.md) (todo coach).

## Topology

- **Brain:** queued intelligence on Orin (Ollama / vLLM). Agents never call OpenAI / xAI / Anthropic.
- **Computer:** prod-mini jail `/home/aerekos/work` (`aerekos-icarus-workspace`). File/git/shell are remote-only when `workspace_worker_id` is set. Down → ASK “Start Computer”, never Orin disk.
- **Browser:** prod-mini Playwright sidecar `aerekos-icarus-browser` (CPU). Navigate → jpeg ASK → user says next → one act → new pic. Frames via `GET /agents/:id/browser/frames/:id`. Stop wipes cookies; pause-to-reorder does not.
- **Heal:** start cheap named containers (workspace, browser, frontend, conductor, STT, Kokoro, TTS cache) after a flake. Never auth_manager. vLLM / XTTS / Ollama: leave stopped after exit 137 / OOM or an explicit `docker stop`.
- **Do not** surprise-start vLLM / XTTS / Ollama after OOM.

## Setup

`POST /api/v1/agents/setup` is idempotent. It writes project settings, binds queued intelligence, provisions `{name}-friend` memory and `{name}-skills` RAG (legacy `{name}-memory` / `{name}-code` aliases), attaches both to the brain (`inject_memory` + `inject_rag`), binds `orin-stt` / `orin-tts-cache` if unset, places the workspace image (alpine + git) and the Playwright browser sidecar, and creates type `icarus`. System Icarus also gets a default daily `idle-review` cron (`0 4 * * *` America/Los_Angeles).

`GET /api/v1/agents/setup/status` probes topology + Computer git/`ls`. Failures show as ASK cards.

Never run e2e or scripts against production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Shop layers

| Layer | Talks to human | Tools | Memory |
|---|---|---|---|
| User layer | Yes (voice / text) | `submit_brief`, `open_ask` (blockers), `open_plan_q`, `propose_plan`, `revise_plan` | Friend pins + rolls + `{name}-friend` retrieve. **No skills RAG.** |
| Manager | No | Explore + `preview` + spawn / replan / `propose_deploy` / `learn_propose` | Goal → Task graph + skills RAG. **No friend pins.** |
| Workers | No | Cursor tools in the jail; `semantic_search` skills; `report_manager` when stuck | Task transcript + persisted messages. **No friend pins.** |

**Modes**

- **Ask:** hangout only. No shop.
- **Plan:** intake + previews + read-only workers. Browse is navigate + screenshot only.
- **Agent:** intake + previews + build. Jail writes + `git_commit` on an `icarus/<task>` PR branch inside the chunk. Merge to default and `git_push` still ASK. Deploy, danger, send-connectors, pay/auth/captcha still ASK.

**Plans.** Program briefs (`make the system better`, `finish all e2e`, `integrate …`) draft an `AgentPlan` (SQLite). `plan_q` then a spoken plan card. Voice “run it” / “yes let’s run that plan” accepts. Tiny jobs (`folder` / `repo` / one URL `browse` / one named `deploy`) stay a single preview ASK — no `AgentPlan`. Plan accept is the write grant for the current step’s claim; deploy / `git_push` / IaC / browse HITL still ASK. Idle and learn-then-apply use the same plan object. Max three open idle plans; they never auto-run.

**Learn.** “Learn React / this paper / this repo” is a durable job (`AgentLearnJob` + pages), not a one-shot fetch. Cap 20 pages / 2MB. Long docs use `webFetchDisk` (2MB), not the 8KB `web_fetch`. Sources ASK before ingest into `{name}-skills`. Net/Computer down → `waiting_net` / `waiting_computer` (do not fail the shop). Stale TTL (14 days) proposes a new hunt ASK — never silent retrain. No LoRA ASK in this slice.

**Cron.** One ticker in `ai_manager` (`AgentCron`, `SKIP_CRON=1` in tests). Once (`run_at`) or recurring (5-field cron + timezone, default America/Los_Angeles). `user_turn` (weather) searches and notifies even if the overlay is closed; if an ASK is already open it enqueues + notifies, it does not replace the card. Late catch-up after outage is labeled “I was down.” Do not dual-write `schedule_manager`.

**Idle review.** System Icarus only unless the project answered “watch this repo?”. Cheap catalog-vs-e2e scan first; LLM only on findings; propose-only plan ASK. Preemptible. Skip if user/manager/execute is in flight. Never prod UUID, never vLLM, never `auth_manager` rebuild.

Vague tiny briefs still get one clarify ASK. In-flight info is not a new preview. “Do X first” revises a draft plan (or reorders the board). One **open** ASK is voice-yesable; others sit **pending** (FIFO). Browse owns the slot until Done / Stop / interrupt-to-reorder.

**Header overlay.** Sparkles icon after search, before the bell. Click-to-talk toggle (shared with the Agents workspace mic). Talks to **system Icarus**; ProjectSwitcher is nav context only. “Take me to Agents” / “show me this project’s containers” uses the nav allowlist. Unknown go-to asks which screen. Compute start/stop is ASK then the real compute_manager API. Overlay is not required for cron notify.

**Outage resume.** `POST /agents/resume` plus `ai_manager` boot (unless `SKIP_RESUME=1`). Order: heal Computer/browser → due `user_turn` crons → in-flight learn jobs → running/queued workers → idle last (skipped if anything else resumed). Open ASKs and proposed plans stay open — never auto-Yes.

**Create X (preview then go):** folder = `mkdir` in jail (must exist before the worker starts); repo = `git init` in jail (not GitHub.com); service = monorepo stub; browse = sidecar screenshot loop; IaC = `kind: project-stack` JSON then apply (never prod UUID); deploy = rsync + restart + `/health` for `frontend` / `conductor` / `ai_manager`. `ai_manager` restarts the brain — say so, then `POST /agents/resume`. Fail health → rollback ASK.

Prompts: `GET/PATCH /agents/:id/prompts`, Reset in Settings. Hard denies stay in code.

One open ASK shown; voice answers only that card. Stop cancels the chunk and wipes browser cookies.

## Other apps (no mic required)

```
GET  /api/v1/agents/:id/asks
POST /api/v1/agents/:id/approve   { ask_id, answer }
GET  /api/v1/agents/:id/timeline?since=
GET  /api/v1/agents/:id/pulse
WS   ai:live:{projectId}  events ai:agent.ask, ai:agent.ask.answered, ai:agent.pulse, ai:agent.done
```

SDK: `client.agents.chat|voice|approve|asks|timeline|subscribeAsks`. CLI: `aerekos agents asks|approve|timeline`.

## Attachable APNs

- `ai:agent:endpoint/{name}` — `client.agents.chat|voice|interrupt|approve`
- `connector:account/{name}` — `client.connectors.invoke`
- Intelligence / STT / TTS / memory stay separate ARNs

Pretty URLs (after gateway presets):

- `POST /v1/projects/{pid}/ai/agent/{name}/chat`
- `POST /v1/projects/{pid}/connector/{name}/invoke`

Scopes: `ai:InvokeAgent`, `ai:InvokeConnector`.

## Live visual

Orbit canvas above chat: sun = user, inner = manager, outer = workers. Subscribe to `ai:live:{projectId}`. Poll `/agents/fleet` and `/agents/:id/pulse` after reconnect.

## Connectors

Kinds: gmail, imap, google-calendar, slack, github, generic-http, generic-mcp. Shared per **project**. Friend memory stays per named agent. Not `email_manager`.

OAuth death → ASK “Reconnect {kind}”. Notify on ASK is queue-only unless send secrets exist.

## CLI / SDK

```
client.agents.setup(projectId, { name: 'icarus' })
client.agents.chat(projectId, 'icarus', { content: 'create folder demo' })
client.agents.approve(projectId, 'icarus', { ask_id, answer: 'Yes' })
client.agents.subscribeAsks(projectId, 'icarus', { onAsk, onAnswered, onPulse })
client.connectors.invoke(projectId, { connector: 'mail', tool: 'count_today' })
```

Catalog: `docs/catalog.js` → `make docs`.

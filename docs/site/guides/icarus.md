# Icarus / AI Manager

AWS-style product docs for the console at **`/icarus`** (service `ai_manager`).

## What is Icarus?

Icarus is the full AI surface for Aerekos Cloud: ChatGPT-style talk, a live 3D plan graph, Fleet (where the brain runs), Models (LLM/TTS/STT/embeddings/bench), and Apps (intelligence ARNs, RAG, app memory, jobs, LoRA, access).

Old **AI Manager** tile hub paths (`/services/ai_manager…`) redirect into `/icarus`.

## Getting started

1. Select a **project** in the header (Icarus never silently chats the system project).
2. Open **`/icarus`** (header sparkle) → **Setup Icarus** if the project has no agent.
3. Send **hey** — gate route `CHAT` streams a friend reply (`ai:job.token` on `ai:live:{projectId}`).
4. Send a do-work prompt — gate `MANAGER` hands off; plan/tasks appear in the 3D graph.
5. Seed fleet endpoints under **Fleet** if the brain banner says offline.

## Concepts

| Concept | Meaning |
|---------|---------|
| Friend / manager / worker | Chat layers; gate chooses CHAT vs MANAGER vs STEER |
| Plan graph | Neo4j / PlanGraphStore + `ai:icarus.graph\|task\|tool\|bench` |
| Friend memory | Pins / rolls on the agent |
| App memory | `/memory/*` stores on intelligence ARNs |
| Ask / Plan / Agent | Composer UX hints — backend gate still owns routing |

## Console guide

- **Chat** — transcript + composer; right pane is live 3D graph + node detail (kind-aware tabs).
- **Fleet** — engines & endpoints (“where the brain runs”).
- **Models** — LLM / TTS / STT / embeddings / bench (old “Serve”).
- **Apps** — intelligence, RAG, app memory, jobs, fine-tunes, access.
- **Skills / Friends / Connectors / Cron / Advanced** — rail drawers (friend memory & orbit viz under Advanced).

## Share a project with a friend (GA)

Same-conductor collab. Open **`/icarus/friends`**: create invite token (optional email) → friend accepts → status chips `pending` / `active` / `revoked`. Viewers are read-only. Live presence uses `ai:friend.presence`. Peer-conductor federation is Preview under Friends → Federation.

## How-to

- Pull a model → Models → LLM  
- Place an engine on Orin → Fleet → Engines  
- Create intelligence + attach RAG/memory → Apps  
- Train/attach LoRA → Apps → Fine-tunes  
- Mint app access → Apps → Access  
- Share project with a human friend → Friends  

## Live events

Subscribe room `ai:live:{projectId}` (or `ai:live`). Allowlisted events include:

`ai:job`, `ai:job.token`, `ai:agent.pulse`, `ai:agent.ask`, `ai:agent.ask.answered`, `ai:agent.done`, `ai:icarus.graph`, `ai:icarus.task`, `ai:icarus.tool`, `ai:icarus.bench`, `ai:friend.presence`, `ai:pull`, `ai:bench`.

## API & SDK

Proxy base: `{CONDUCTOR}/api/services/ai_manager/api/v1/…`

See generated [ai_manager service doc](../services/ai_manager.md), runbooks under `docs/runbooks/icarus*`, and `aerekos-sdk` invoke examples for agents chat / icarus plans.

## Troubleshooting

| Symptom | Check |
|---------|--------|
| Silent hang after Send | Brain offline banner; Orin/dev LLM path; fleet endpoints |
| Graph never updates | LiveRoom allowlist for `ai:icarus.*`; room `ai:live:{projectId}` |
| Wrong project chat | Header project chip vs URL — must match current project |
| ASK stuck | Approve chips in Chat; pending ASK badge on Chat rail |

## Related runbooks

- [icarus-agents.md](../runbooks/icarus-agents.md)
- [icarus-live-e2e.md](../runbooks/icarus-live-e2e.md)
- [icarus.md](../runbooks/icarus.md)

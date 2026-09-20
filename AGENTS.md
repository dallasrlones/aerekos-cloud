# Agents working on aerekos-cloud

This repo is a mixed-stack homelab control plane (conductor + worker managers + React Native console).

## Auth

- Console login: `POST /api/auth/login` `{ username, password }`.
- Icarus C0 mint: `POST /api/v1/auth/token` on **auth_manager** (must survive rebuild).
- Manager proxy: JWT or service token through conductor `/api/services/:name/*`.
- Project scope: most manager calls need `project_id` (query, body, or `x-project-id`).

## URLs

- UI: `https://cloud.aerekos.com/`
- API: `https://cloudapi.aerekos.com`
- SSH: `prod.aerekos.com`, `dev.aerekos.com`, `orin.aerekos.com`

## Hard rules

- Never mutate production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e/scripts.
- Email / SMS / Slack / Push: **send when project/env secrets exist**; otherwise queue-only. Do not invent provider accounts.
- Never `docker compose ... --remove-orphans` on prod-mini (two compose projects). Never `deploy.sh full` if it orphans the other project.
- vLLM: start only on **orin**. If it OOMs (exit 137), leave it stopped.
- AI engines (vLLM / Whisper / Kokoro / TTS cache / XTTS / Ollama): place from AI Manager. A device is `docker run` the worker — no host Ollama/tools install. Do not start voice from `~/work/tools`. Never auto-start vLLM/XTTS/Ollama if down.
- Do not overwrite live `.env`, `worker/.env`, data, or `node_modules` on rsync (`scripts/deploy/push-to-host.sh` has no `--delete`).
- Default `admin`/`admin` seed only when `ALLOW_DEFAULT_ADMIN_SEED=1`.
- `NODE_ENV=production` refuses dummy JWT/TOKEN/master keys, `MOCK_KEY_MANAGER=true`, and `SKIP_*` fakes.

## How to call things

- Human + agent SDK: `aerekos-sdk` (`client.backup.*`, `client.iac.*`, `client.edge.*`, `client.systems.*`, `client.graphql.execute`, `client.search.query`, `client.intelligence.submit|job|wait|cancel|subscribe`, `client.agents.*`, `client.connectors.invoke`, `client.queue.list|send|receive`).
- Icarus agents: AI Manager → Agents (`https://cloud.aerekos.com/services/ai_manager/agents`). System Home: GPU & AI. Brain is queued intelligence on Orin. Computer is prod-mini `/home/aerekos/work`. Shop: user layer brief → manager preview → workers. Writes ASK (chunk grant after Yes). Live is `ai:live` + `ai:agent.pulse` + `ai:agent.ask`. See `docs/runbooks/icarus-agents.md`.
- CLI: `aerekos backup run`, `aerekos iac hookup`, `aerekos systems update --target docker`, `aerekos intelligence submit|job|wait|cancel`, `aerekos agents setup|chat`, `aerekos connectors invoke`.
- Queued intelligence: `POST /intelligence/chat` on `execution: queued` returns 409 — use jobs. Poll is source of truth; WS `ai:live:{projectId}` is the accelerator.
- Catalog source: `docs/catalog.js` then `make docs`.
- MCP tool schemas live on `mcp_manager` and should match those endpoints.

See also `docs/llms.txt` and `docs/agents.md`.

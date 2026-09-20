# Agent / MCP tool calling

Copy-paste shapes for copilots. All paths are on the conductor. Use a JWT from `/api/auth/login` or a service token.

## Intelligence jobs

```
POST /api/services/ai_manager/api/v1/intelligence/jobs
{ "project_id", "intelligence", "messages": [{ "role": "user", "content": "…" }] }
GET  /api/services/ai_manager/api/v1/intelligence/jobs/:id?project_id=
POST /api/services/ai_manager/api/v1/intelligence/jobs/:id/cancel
```

SDK: `client.intelligence.submit / job / wait / cancel / subscribe`. Sync `chat()` stays for warmups. Queued endpoints 409 on `POST /chat`.

## Icarus agents

Console: `https://cloud.aerekos.com/services/ai_manager/agents`. Hub: `/services/ai_manager`. System Home lists **GPU & AI → AI Manager**.

```
POST /api/services/ai_manager/api/v1/agents/setup
{ "project_id", "name": "icarus", "timezone": "America/Los_Angeles" }
POST /api/services/ai_manager/api/v1/agents/:id/chat
{ "project_id", "content": "what is going on today?" }
POST /api/services/ai_manager/api/v1/connectors/invoke
{ "project_id", "connector": "mail", "tool": "count_today" }
```

SDK: `client.agents.setup / chat / interrupt / approve / asks / timeline / subscribeAsks`. `client.connectors.invoke`. Live: `ai:live:{projectId}` + `ai:agent.pulse` + `ai:agent.ask`. Header overlay is system Icarus; friend vs skills are lane-split; resume heals then crons then learn then workers (idle last). Never e2e-touch `ea370977-3aff-4c76-95a6-a0c50fd2bce7`. See `docs/runbooks/icarus-agents.md`.

## Backup

```
POST /api/services/backup_manager/api/v1/jobs
{ "project_id": "...", "source": "db_manager", "resource": "mydb", "vault": "default" }
```

Restore: `POST /api/services/backup_manager/api/v1/jobs/:id/restore` `{ "project_id", "dest?" }`.

SDK: `client.backup.run / jobs / get / restore`.

## IaC

`GET /api/projects/:id/iac/status` → `{ hooked_up, mode, missing }`
`POST /api/projects/:id/iac/hookup` `{ "mode": "git"|"conductor", "repo": "infra" }`
`GET /api/projects/:id/stack`
`PUT /api/projects/:id/stack`
`POST /api/projects/:id/stack/apply` — enables `wanted[]` then provisions resources. Never production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.
SDK: `client.stacks.get / put / apply`. CLI: `aerekos iac put --data`.

## Edge

`GET /api/projects/:id/edge/status`
`POST /api/projects/:id/edge/hookup` — uses secrets `cloudflare_api_token` + `cloudflare_account_id` only. Does not sign up for Cloudflare.

## Systems (host OS / Docker)

`GET|POST /api/workers/:id/host/check`
`POST /api/workers/:id/host/update` `{ "target": "os"|"docker" }`
Never auto-run. One device at a time. Distinct from agent Update now.

## GraphQL / search / quota

`POST /api/services/graphql_manager/api/v1/execute` `{ project_id, name, query }`
`POST /api/services/search_manager/api/v1/query` `{ project_id, q }` → real FTS hits
`POST /api/services/billing_manager/api/v1/evaluate-quota` — deny when over; never `{ unlimited: true }`

## Send-disabled

`email_manager`, `sms_manager`, `slack_manager`, `push_manager` queue only (`outbound_disabled` / `queue_only`). Do not retry live send.

## Do not

- Hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e
- `--remove-orphans` on the mixed stack
- Start vLLM on prod-mini
- Start Orin voice (STT/Kokoro/cache) from `~/work/tools` — Cloud compose (`aerekos-ai`) is the deployer

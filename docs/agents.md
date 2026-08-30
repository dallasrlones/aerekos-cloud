# Agent / MCP tool calling

Copy-paste shapes for copilots. All paths are on the conductor. Use a JWT from `/api/auth/login` or a service token.

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
`POST /api/projects/:id/stack/apply`

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

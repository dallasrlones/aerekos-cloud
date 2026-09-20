# icarus-assistant on aerekos-git

Source lives in its own repo (`/Users/dallaslones/work/icarus-assistant`). aerekos-cloud does not vendor that tree.

Cloud-owned on **prod-mini** (empty pin = local). Not adopted. Compose leftover `icarus-assistant-api-server-1` has been removed.

## Live IDs

| What | Value |
|------|--------|
| Project | `aec3af8b-5250-4fd4-aa41-ca27654de029` (`icarus-assistant`) |
| Repo | `a2eb6660-074a-4fae-aee0-9c1aafad7371` |
| Pipeline | `94cf7fc1-9142-477c-a7f7-83a00f2ae6b4` |
| Managed task | `040b6172-28c4-45fc-b708-83cfc203020c` |
| Container | `aer-cmp-040b617228c4-icarus-assistant` |
| Image | `aer-cmp-icarus-assistant:cloud` |
| Intelligence | `icarus-assistant` (change model on that intelligence, not in the Icarus UI) |

Not the system project (`9d8bde11-…`). Not docunu-dev (`ea370977-…`).

## Git + CI

- Origin: `https://git.aerekos.com/icarus-assistant.git`
- Env `prod` / pipeline `git_ref: main`. Feature-branch pushes skip deploy (`not_deploy_branch`).
- `require_pr=false`. `hostname: assistant.aerekos.com`, `port: 4200`, target linked.
- Workflow: `.aerekos/workflows/deploy.yml` (`jobs: [deploy]`)
- Volume: `icarus-assistant_icarus-assistant-data` → `/data` (compose-named; do not create a fresh `icarus-assistant-data`)
- The git bundle currently fails `git clone` (`pack has bad object`). Until that is re-pushed, do not expect CI replace-image from source. Live image is the tagged Cloud name above.

## Hosts

- App: prod-mini `:4200` on the **aerekos** tunnel (`assistant.aerekos.com`)
- Empty pin — do not set `pin_worker_id` (would teleport a stateful volume)
- LLM stays on Orin. Intelligence `icarus-assistant` should be `execution: queued` so phone HTTP returns 202 (Cloudflare 524 otherwise).
- Assistant `POST /v1/chats/:id/messages` submits `client.intelligence.submit`, returns `{ accepted, job_id, turn_id }`, then poll `GET /v1/turns/:id` and `/ws` `chat_token` / `chat_job`. Keep-alive stays on sync `llm/chat`.

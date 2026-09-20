# icarus (Cursor-replacement app)

Source: `/Users/dallaslones/work/icarus`. Not `icarus-assistant` and not `icarus-agent`.

Cloud-owned on **prod-mini** (empty pin). Images were loaded from the stopped Orin leftovers (`icarus-server:latest`, `icarus-app:latest`). Store bind: `/home/aerekos/work/icarus/store` → `/app/store`. Workspace: `/home/aerekos/work` → `/workspace`. docker.sock is mounted for cursor-agent.

Cursor usage pill needs the desktop JWT. Prod-mini is headless, so mount the tiny auth stub (not the multi-GB `state.vscdb`):

- Host: `/home/aerekos/work/icarus/.cursor-ro-stub` → `/cursor-app:ro`
- Env already set: `CURSOR_DESKTOP_PATH=/cursor-app/User/globalStorage/state.vscdb`
- Refresh stub from a signed-in Cursor desktop: `cd /Users/dallaslones/work/icarus/server && npm run export-cursor-auth-stub -- ../.cursor-ro-stub/User/globalStorage/state.vscdb` then rsync that file to prod-mini. Do not commit `.cursor-ro-stub`.

neo4j / searxng are **not** required by this compose and were not created.

## Live IDs

| What | Value |
|------|--------|
| Project | `b00b63a8-2922-40f1-ae39-72b66ff685bf` (`icarus`) |
| Repo | `06499b69-4a8a-4748-bd98-b32462dff423` |
| Task API | `d2060cef-2c3a-4b20-82be-c681eb02a8eb` (`icarus-api`, `:4000`) |
| Task web | `beffba72-defb-4891-9dce-184aef7a2f0e` (`icarus-web`, `:8081`) |
| Pipeline API | `f21e71f7-ac29-4602-bd34-97ec3fe8250f` (`server/Dockerfile`) |
| Pipeline web | `3be07847-a9a9-4d17-989a-e0cfdfbe9795` (`app/Dockerfile`) |

## Hostnames

Moved off the Orin tunnel onto the **aerekos** (prod-mini) tunnel. Do not mint a tunnel.

- `icarusapi.aerekos.com` → `:4000`
- `icarus.aerekos.com` → `:8081`

Orin `icarus-app` / `icarus-server` stay **stopped**. They no longer serve these hostnames.

## Git + CI

- Env `prod` / `git_ref: main` / `require_pr=false`
- Targets + hostnames linked. A non-`main` push does not deploy.
- Push the Mac tree to `https://git.aerekos.com/…/icarus.git` before expecting CI builds.

## Voice (Talk)

Talk / synthesize goes through Cloud integrations (`orin-stt`, `orin-tts-kokoro`, `orin-tts-cache`). Place and start those engines in AI Manager → Engines, not Container Hosting. Icarus-assistant is an app that consumes Cloud; it does not own Whisper/Kokoro/vLLM. `~/work/tools` compose is leftover.

## Constraints

- No LLM / vLLM / intelligence changes.
- Stateful store stays pinned to prod-mini.
- `CURSOR_API_KEY` lives in secrets_manager for env `prod`, not in the console env box. `TaskService.mergeEnvSecrets` injects it on place/replace (requires `../../../shared/conductorProxy`).
- `AEREKOS_API_URL` is the public conductor (`https://cloudapi.aerekos.com`). Do not put LAN IPs or `host.docker.internal` in app env — phones and off-LAN clients surface those as load/voice errors.
- Public web is a static Expo export behind nginx on `:8081` (`icarus-app:latest`). Do not run Metro in prod.

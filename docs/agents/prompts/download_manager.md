# Agent prompt — download_manager

Download lists/items with optional qBittorrent + yt-dlp + tor-dl search. Not MediaConvert. No production skip-fakes (`assertNoSkipFakes` + `SKIP_TORRENT` extra; `SKIP_DOWNLOAD` in shared defaults via `createManagerApp`). **Tutorial:** none standalone; dedicated DownloadManager screen (no CONSOLE_GUIDES ServiceGuide).

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/download_manager{path}`

**Port:** `3133` · **OpenAPI:** `worker/download_manager/api/openapi.yaml` (pack: `docs/openapi/download_manager.yaml`)

Provider note: Live download needs qBittorrent/yt-dlp + egress. See `docs/plans/download_manager_qbit_fix.md`.

## Endpoints

- `GET /health` / `GET /ready` — liveness / readiness (SQLite)
- `GET /api/v1/info` — metadata
- `POST /api/v1/ensure-defaults` — seed inbox + overnight window
- `POST /api/v1/quick-add` — add URLs/magnets
- `POST /api/v1/search` / `POST /api/v1/search/youtube` — search
- `POST /api/v1/lists` — Create a list ({ project_id, name, ... })
- `GET /api/v1/lists` — List lists (?project_id=)
- `GET /api/v1/lists/:id` — Get one list
- `PATCH`/`PUT /api/v1/lists/:id` — Update a list
- `DELETE /api/v1/lists/:id` — Delete a list
- `GET`/`POST /api/v1/lists/:id/items` — items on a list
- `GET`/`PATCH`/`DELETE /api/v1/items[/:id]` — items
- `POST /api/v1/items/:id/pause|resume|retry` — status actions
- `POST /api/v1/tick` — advance pending downloads
- CRUD `/api/v1/windows`, `/api/v1/indexers`

SDK: `client.resource('download_manager', 'lists')`. CLI: `aerekos download_manager lists …` or `aerekos call`.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

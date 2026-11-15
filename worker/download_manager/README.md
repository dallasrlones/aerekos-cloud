# download_manager

**AWS analog:** MediaConvert + ingest · **Port:** `3133`

Project-scoped **download lists** and **items** (HTTP/yt-dlp URLs + magnets/torrents), with download **windows**, optional **indexers**, Jackett/`tor-dl` search, YouTube search via yt-dlp, and an in-process **tick** scheduler. SQLite via `aerekos-record`. Not MediaConvert — naming analog only. `SKIP_DOWNLOAD` / `SKIP_TORRENT` are test/dev only (refused in production via `assertNoSkipFakes`).

## Status / honesty

| Claim | Reality |
|-------|---------|
| Lists / items CRUD | Real SQLite via `/api/v1/lists`, `/api/v1/items` |
| Quick-add | `POST /api/v1/quick-add` creates items (inbox + overnight defaults) |
| Live download | Needs qBittorrent and/or yt-dlp + egress; under `SKIP_DOWNLOAD` tick fakes complete |
| Torrents | Needs `QBITTORRENT_URL` (+ auth); `SKIP_TORRENT` fakes complete |
| Search | `POST /api/v1/search` (tor-dl scrapers) · `POST /api/v1/search/youtube` (yt-dlp) |
| MediaConvert parity | Naming analog only — no AWS MediaConvert client |
| Prod mocks | No `SKIP_DOWNLOAD` / `SKIP_TORRENT` / shared skip-fakes when `NODE_ENV=production` |
| Tutorial | **None** standalone — dedicated **DownloadManager** screen (no `CONSOLE_GUIDES` ServiceGuide) |

## Access

- Direct: `http://localhost:3133/...`
- Conductor proxy: `{CONDUCTOR}/api/services/download_manager{path}` (JWT or service token)

## Paths

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/metrics` | Prometheus text |
| `GET` | `/api/v1/info` | Metadata (`status: "active"`) |
| `POST` | `/api/v1/ensure-defaults` | Seed inbox list + overnight window |
| `POST` | `/api/v1/quick-add` | Add URLs/magnets to a list |
| `POST` | `/api/v1/search` | Torrent search (`tor-dl`) |
| `POST` | `/api/v1/search/youtube` | YouTube search (yt-dlp) |
| `POST`/`GET`/`PATCH`/`DELETE` | `/api/v1/lists[/:id]` | Lists CRUD |
| `GET`/`POST` | `/api/v1/lists/:id/items` | List / add items on a list |
| `GET`/`PATCH`/`DELETE` | `/api/v1/items[/:id]` | Items |
| `POST` | `/api/v1/items/:id/pause\|resume\|retry` | Status actions |
| `POST` | `/api/v1/tick` | Advance pending downloads (optional `{ now }`) |
| CRUD | `/api/v1/windows`, `/api/v1/indexers` | Windows + indexers |

OpenAPI: [`api/openapi.yaml`](./api/openapi.yaml) · pack copy [`docs/openapi/download_manager.yaml`](../../docs/openapi/download_manager.yaml). Catalog: [`docs/services/download_manager.md`](../../docs/services/download_manager.md).

## SDK / CLI

- **SDK (Node):** `client.resource('download_manager', 'lists')` (create/list/get/update/delete). Items/quick-add/tick via SDK/`aerekos call` / curl.
- **CLI:** `aerekos download_manager lists list|get|create|update|delete --project $PID` (and `-d` JSON for create/update), or generic `aerekos call`.

## Quick start

```bash
cd worker/download_manager
cp .env_example .env   # optional
npm install            # Node 20+
npm start
# curl http://localhost:3133/health
```

## Environment

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `3133` | Listen port |
| `DATABASE_PATH` | `data/download_manager.db` | SQLite file |
| `SKIP_SERVICE_REGISTRATION` | unset | `true` in tests |
| `SKIP_DOWNLOAD` | unset | Skip live download in tests/dev only |
| `SKIP_TORRENT` | unset | Skip qBittorrent in tests/dev only |
| `DISABLE_TICKER` | unset | `1` disables in-process ticker |
| `QBITTORRENT_URL` | unset | Optional live torrent engine |
| `CONDUCTOR_URL` | unset | Optional auto-registration |

## Testing

| Layer | Command | Notes |
|-------|---------|--------|
| Unit | `npm run test:unit` | prod guard + `assertNoSkipFakes` wiring |
| Integration | `npm run test:integration` | health/ready/info + CRUD + windows/quick-add/tick |
| All | `npm test` | unit + integration |
| Live e2e | needs conductor | Proxy path parked; root `e2e/catalog.js` lists CRUD |

## Related

- Conductor seed / `managerServicePorts` → `3133`
- qBittorrent auth notes: [`docs/plans/download_manager_qbit_fix.md`](../../docs/plans/download_manager_qbit_fix.md)
- Root [`GOLDEN_PATH.md`](../../GOLDEN_PATH.md)

# download_manager — MediaConvert + ingest

> **Storage & Content** · Implemented · needs qBittorrent/yt-dlp + egress for live download

Project-scoped download **lists** / **items** (HTTP/yt-dlp + magnets), windows, indexers, search, and tick scheduler. Not a MediaConvert client. **Tutorial / ServiceGuide:** none standalone — dedicated **DownloadManager** console screen (no `CONSOLE_GUIDES` entry). No production `SKIP_DOWNLOAD` / `SKIP_TORRENT` mocks.

- **Port:** `3133`
- **AWS analog:** MediaConvert + ingest
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/download_manager{path}` (JWT or service token)
- **Capabilities:** `download`, `torrent`, `yt-dlp`
- **OpenAPI:** `worker/download_manager/api/openapi.yaml` (pack copy: `docs/openapi/download_manager.yaml`)
- **SDK/CLI:** `client.resource('download_manager', 'lists')`; CLI `aerekos download_manager lists …` / `aerekos call`

> ⚠️ **Provider activation:** Live download needs qBittorrent and/or yt-dlp + network egress. See `docs/plans/download_manager_qbit_fix.md` for Web UI auth.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/ensure-defaults` | Seed inbox + overnight window |
| `POST` | `/api/v1/quick-add` | Add URLs/magnets |
| `POST` | `/api/v1/search` | Torrent search |
| `POST` | `/api/v1/search/youtube` | YouTube search |
| `POST` | `/api/v1/lists` | Create a list ({ project_id, name, ... }) |
| `GET` | `/api/v1/lists` | List lists (?project_id=) |
| `GET` | `/api/v1/lists/:id` | Get one list |
| `PATCH` | `/api/v1/lists/:id` | Update a list |
| `DELETE` | `/api/v1/lists/:id` | Delete a list |
| `GET`/`POST` | `/api/v1/lists/:id/items` | Items on a list |
| `GET`/`PATCH`/`DELETE` | `/api/v1/items[/:id]` | Items |
| `POST` | `/api/v1/items/:id/pause\|resume\|retry` | Status actions |
| `POST` | `/api/v1/tick` | Advance pending downloads |
| CRUD | `/api/v1/windows`, `/api/v1/indexers` | Windows + indexers |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/download_manager/api/v1/lists?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('download_manager', 'lists');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos download_manager lists create --project $PID --data '{"name":"demo"}'
aerekos download_manager lists list --project $PID
aerekos call download_manager POST "/api/v1/quick-add" --project $PID --data '{"urls":["https://example.com/a.mp4"]}'
```

---

_Hand-aligned with `worker/download_manager` for Wave 5 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

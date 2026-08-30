# download_manager — MediaConvert + ingest

> **Storage & Content** · Implemented

Download lists.

- **Port:** `3133`
- **AWS analog:** MediaConvert + ingest
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/download_manager{path}` (JWT or service token)
- **Capabilities:** `download`, `torrent`, `yt-dlp`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/lists` | Create a list ({ project_id, name, ... }) |
| `GET` | `/api/v1/lists` | List lists (?project_id=) |
| `GET` | `/api/v1/lists/:id` | Get one list |
| `PATCH` | `/api/v1/lists/:id` | Update a list |
| `DELETE` | `/api/v1/lists/:id` | Delete a list |

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
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

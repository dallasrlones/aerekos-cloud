# crawler_manager — Glue Crawler

> **AI** · Implemented · needs provider keys for live calls

Crawl job metadata (start_url/max_depth/state). Real fetching needs network egress.

- **Port:** `3121`
- **AWS analog:** Glue Crawler
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/crawler_manager{path}` (JWT or service token)
- **Capabilities:** `crawler`, `jobs`

> ⚠️ **Provider activation:** Network egress + enabling real fetch to crawl.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/jobs` | Create a job ({ project_id, name, ... }) |
| `GET` | `/api/v1/jobs` | List jobs (?project_id=) |
| `GET` | `/api/v1/jobs/:id` | Get one job |
| `PATCH` | `/api/v1/jobs/:id` | Update a job |
| `DELETE` | `/api/v1/jobs/:id` | Delete a job |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/crawler_manager/api/v1/jobs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
const r = client.resource('crawler_manager', 'jobs');
await r.create(PID, { name: 'demo' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos crawler_manager jobs create --project $PID --data '{"name":"demo"}'
aerekos crawler_manager jobs list --project $PID
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

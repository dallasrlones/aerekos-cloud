# crawler_manager — Glue Crawler

> **AI** · Implemented · needs network egress for live fetch

Project-scoped crawl job metadata (`start_url`/`max_depth`/`state`/`result_summary`) plus optional single-URL `run` and canary probe. Not a full site crawler / Glue client. **Tutorial / ServiceGuide:** none standalone — console generic **ManagerConsole** (no dedicated `CONSOLE_GUIDES` entry). No production `SKIP_CRAWL` mocks.

- **Port:** `3121`
- **AWS analog:** Glue Crawler
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/crawler_manager{path}` (JWT or service token)
- **Capabilities:** `crawler`, `jobs`
- **OpenAPI:** `worker/crawler_manager/api/openapi.yaml` (pack copy: `docs/openapi/crawler_manager.yaml`)
- **SDK/CLI:** `client.resource('crawler_manager', 'jobs')`; CLI `aerekos crawler_manager jobs …` / `aerekos call`

> ⚠️ **Provider activation:** Network egress required for live `run` / canary (catalog `needs-keys`).

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/jobs/canary` | One-shot URL canary (`{ url }`) |
| `POST` | `/api/v1/jobs` | Create a job ({ project_id, name, ... }) |
| `GET` | `/api/v1/jobs` | List jobs (?project_id=) |
| `GET` | `/api/v1/jobs/:id` | Get one job |
| `PATCH` | `/api/v1/jobs/:id` | Update a job |
| `POST` | `/api/v1/jobs/:id/run` | Fetch `start_url` once / update summary |
| `DELETE` | `/api/v1/jobs/:id` | Delete a job |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/crawler_manager/api/v1/jobs?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","start_url":"https://example.com"}'
```

**SDK (Node)**

```js
const r = client.resource('crawler_manager', 'jobs');
await r.create(PID, { name: 'demo', start_url: 'https://example.com' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos crawler_manager jobs create --project $PID --data '{"name":"demo","start_url":"https://example.com"}'
aerekos crawler_manager jobs list --project $PID
aerekos call crawler_manager POST "/api/v1/jobs/{id}/run" --project $PID
```

---

_Hand-aligned with `worker/crawler_manager` for Wave 4 closeout honesty. Catalog CRUD also lives in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

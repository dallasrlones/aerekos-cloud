# metrics_manager — CloudWatch Metrics

> **Observability** · Implemented

Stored metric series samples (name/value/labels) plus alarm rules that can publish into `event_manager` on evaluate. Aggregation cluster / Prometheus federation is future work. No production mocks (`assertNoSkipFakes()`). **Tutorial / ServiceGuide:** none.

- **Port:** `3105`
- **AWS analog:** CloudWatch Metrics
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/metrics_manager{path}` (JWT or service token)
- **Capabilities:** `metrics`, `samples`, `alarms`
- **OpenAPI:** `worker/metrics_manager/api/openapi.yaml` (pack copy: `docs/openapi/metrics_manager.yaml`)
- **SDK/CLI:** `client.resource('metrics_manager', 'series')` / `client.proxy('metrics_manager', …)`; CLI `aerekos call metrics_manager …`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (SQLite) |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `POST` | `/api/v1/series` | Create a series sample |
| `POST` | `/api/v1/series/sample` | Upsert sample by name |
| `POST` | `/api/v1/series/scrape` | Record scrape sample |
| `GET` | `/api/v1/series` | List series (metric_name, task_id, limit) |
| `GET` | `/api/v1/series/:id` | Get one series |
| `PATCH` | `/api/v1/series/:id` | Update a series |
| `DELETE` | `/api/v1/series/:id` | Delete a series |
| `POST` | `/api/v1/alarms` | Create an alarm rule |
| `GET` | `/api/v1/alarms` | List alarms |
| `GET` | `/api/v1/alarms/:id` | Get one alarm |
| `PATCH` | `/api/v1/alarms/:id` | Update an alarm |
| `DELETE` | `/api/v1/alarms/:id` | Delete an alarm |
| `POST` | `/api/v1/alarms/evaluate` | Evaluate alarms (SKIP_OUTBOUND parks publish) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/metrics_manager/api/v1/series?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","metric_name":"cpu","value":"0.1"}'
```

**SDK (Node)**

```js
const r = client.resource('metrics_manager', 'series');
await r.create(PID, { name: 'demo', metric_name: 'cpu', value: '0.1' });
console.log(await r.list(PID));
```

**CLI**

```bash
aerekos call metrics_manager POST "/api/v1/series" --project $PID --data '{"name":"demo","value":"0.1"}'
```

---

_Hand-aligned with `worker/metrics_manager` for Wave 6 closeout honesty. Catalog endpoints live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

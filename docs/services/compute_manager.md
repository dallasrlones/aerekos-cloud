# compute_manager — ECS / Fargate

> **Compute** · Implemented

Run containerized tasks (dockerode): create/list/get/stop/delete project-scoped tasks with port maps and labels.

- **Port:** `3100`
- **AWS analog:** ECS / Fargate
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/compute_manager{path}` (JWT or service token)
- **Capabilities:** `containers`, `tasks`, `docker`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/tasks` | Create a task |
| `GET` | `/api/v1/tasks` | List tasks (?refresh=1 to reconcile) |
| `GET` | `/api/v1/tasks/:id` | Get a task |
| `POST` | `/api/v1/tasks/:id/stop` | Stop a task |
| `DELETE` | `/api/v1/tasks/:id` | Delete a task |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `SKIP_DOCKER` | `0` | Metadata-only mode (no Docker daemon) |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/compute_manager/api/v1/tasks?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('compute_manager', { method: 'POST', path: '/api/v1/tasks', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call compute_manager POST "/api/v1/tasks" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

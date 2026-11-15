# registry_manager — ECR

> **Dev tools** · Implemented

Container registry discovery: per-project registry entries (no pull secrets), public config, artifacts, wanted pulls, and project-scoped image picker. No production mocks (`assertNoSkipFakes` refuses `SKIP_DOCKER` in prod). **Tutorial / ServiceGuide:** none (RegistryManager IntegrationHub only).

- **Port:** `3129`
- **AWS analog:** ECR
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/registry_manager{path}` (JWT or service token)
- **Capabilities:** `registry`, `oci`, `images`
- **OpenAPI:** `worker/registry_manager/api/openapi.yaml` (pack copy: `docs/openapi/registry_manager.yaml`)
- **SDK/CLI:** `client.resource('registry_manager', 'registries')` / `client.proxy`; CLI `aerekos call` (no dedicated verb)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
| `GET` | `/api/v1/registry/config` | Public registry config (no secrets) |
| `POST` | `/api/v1/registries` | Create a registry entry |
| `GET` | `/api/v1/registries` | List entries |
| `GET` | `/api/v1/registries/:id` | Get an entry |
| `PATCH` | `/api/v1/registries/:id` | Update an entry |
| `DELETE` | `/api/v1/registries/:id` | Delete an entry |
| `GET` | `/api/v1/artifacts` | List artifacts |
| `POST` | `/api/v1/artifacts` | Create artifact |
| `GET` | `/api/v1/wanted` | List wanted images |
| `POST` | `/api/v1/wanted` | Create wanted image |
| `PATCH` | `/api/v1/wanted/:id` | Update wanted |
| `DELETE` | `/api/v1/wanted/:id` | Delete wanted |
| `POST` | `/api/v1/wanted/:id/run-now` | Pull now |
| `GET` | `/api/v1/images/project` | Project-scoped images |
| `POST` | `/api/v1/images/import` | Import tar via docker load |
| `GET` | `/api/v1/inventory` | Host docker inventory |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/registry_manager/api/v1/registries?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo","registry_url":"harbor.example.com"}'
```

**SDK (Node)**

```js
const r = client.resource('registry_manager', 'registries');
await r.create(PID, { name: 'demo', registry_url: 'harbor.example.com' });
console.log(await r.list(PID));
// or generic proxy
await client.proxy('registry_manager', { method: 'GET', path: '/api/v1/registry/config', projectId: PID });
```

**CLI**

```bash
aerekos call registry_manager POST "/api/v1/registries" --project $PID --data '{"name":"demo","registry_url":"harbor.example.com"}'
aerekos call registry_manager GET "/api/v1/registry/config"
```

No dedicated `aerekos registry` subcommand.

---

_Hand-aligned with `worker/registry_manager` for Wave 3 closeout honesty. Catalog extras live in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

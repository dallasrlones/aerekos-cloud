# iam_manager — IAM

> **Identity** · Implemented

Roles, policies (allow/deny JSON documents), and role↔policy bindings. Enforcement lives in the conductor.

- **Port:** `3106`
- **AWS analog:** IAM
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/iam_manager{path}` (JWT or service token)
- **Capabilities:** `rbac`, `roles`, `policies`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/roles` | Create a role |
| `GET` | `/api/v1/roles` | List roles |
| `GET` | `/api/v1/roles/:id` | Get a role |
| `PATCH` | `/api/v1/roles/:id` | Update a role |
| `DELETE` | `/api/v1/roles/:id` | Delete a role |
| `POST` | `/api/v1/roles/:roleId/policies` | Attach a policy to a role |
| `GET` | `/api/v1/roles/:roleId/policies` | List a role's policies |
| `DELETE` | `/api/v1/roles/:roleId/policies/:policyId` | Detach a policy |
| `POST` | `/api/v1/policies` | Create a policy |
| `GET` | `/api/v1/policies` | List policies |
| `GET` | `/api/v1/policies/:id` | Get a policy |
| `PATCH` | `/api/v1/policies/:id` | Update a policy |
| `DELETE` | `/api/v1/policies/:id` | Delete a policy |

## Examples

**curl**

```bash
# through the conductor proxy (JWT)
curl -s -X POST \
  "$CONDUCTOR/api/services/iam_manager/api/v1/roles?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)**

```js
// generic proxy
await client.proxy('iam_manager', { method: 'POST', path: '/api/v1/roles', projectId: PID, body: { name: 'demo' } });
```

**CLI**

```bash
aerekos call iam_manager POST "/api/v1/roles" --project $PID --data '{"name":"demo"}'
```

---

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

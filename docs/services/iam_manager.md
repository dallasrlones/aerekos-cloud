# iam_manager — IAM

> **Identity** · Implemented

Roles, allow/deny JSON policies, role↔policy bindings, and **evaluate**. Conductor can enforce human JWT access at the proxy when `IAM_ENFORCE_PROXY=true` (calls this service’s evaluate). App credentials use ARN/scope separately — see [identity architecture](../architecture/identity.md).

- **Port:** `3106`
- **AWS analog:** IAM
- **Proxy base:** `/api/v1`
- **Access:** `{VERB} {CONDUCTOR}/api/services/iam_manager{path}` (JWT or service token)
- **Capabilities:** `rbac`, `roles`, `policies`
- **OpenAPI:** [`worker/iam_manager/api/openapi.yaml`](../../worker/iam_manager/api/openapi.yaml)
- **Mocks:** none in production paths (SQLite is the store)

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `GET` | `/ready` | Readiness |
| `GET` | `/api/v1/info` | Service metadata |
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
| `POST` | `/api/v1/evaluate` | Evaluate allow/deny for action + resource |

All project-scoped routes require `project_id` (query, body, or `X-Project-Id`).

## Examples

**curl**

```bash
curl -s -X POST \
  "$CONDUCTOR/api/services/iam_manager/api/v1/roles?project_id=$PID" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"project_id":"'$PID'","name":"demo"}'
```

**SDK (Node)** — thin `client.iam.evaluate` → conductor `POST /api/iam/evaluate`; CRUD via proxy / `client.svc.iam_manager`

```js
await client.iam.evaluate({
  project_id: PID,
  role_name: 'demo',
  action: 'storage:GetObject',
  resource_arn: ARN,
});
```

**CLI** — generic `aerekos call` (no dedicated `aerekos iam` verbs yet)

```bash
aerekos call iam_manager POST "/api/v1/roles" --project $PID --data '{"name":"demo"}'
```

## Tutorial / ServiceGuide

**Tutorial: none.** Console ServiceGuide blurb is on ManagerConsole (`iam_manager` guide in `conductor/app/screens/ManagerConsole/ManagerConsole.jsx`).

---

_Hand-maintained for closeout honesty. Catalog endpoints in `docs/catalog.js` should stay in sync; `make docs` regenerates the site from the catalog._

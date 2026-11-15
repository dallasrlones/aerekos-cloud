# conductor — Control plane (the AWS console + API)

> **Control plane** · Implemented

Master orchestrator: authentication, the service registry + proxy, worker fleet management, project scoping, and the React Native dashboard. Every client and SDK call enters here.

- **Port:** `3000`
- **AWS analog:** Control plane (the AWS console + API)
- **Proxy base:** `/api`
- **Capabilities:** `auth`, `service-registry`, `proxy`, `workers`, `projects`, `metrics`

## Health / proxy honesty

| Path | Auth | Notes |
|------|------|-------|
| `GET /health` | none | Liveness; `database` may be `connected` or `initializing` |
| `GET /ready` | none | Readiness; SQLite query required or 503 |
| Manager `/health` \| `/ready` via proxy | conductor Bearer still required | `isLivenessPath` skips **projectId** only (`ServiceManager`) |
| Other proxied paths | `appProxyAuth` / authenticate | `projectId` required |

OpenAPI pack: [`docs/openapi/conductor.yaml`](../openapi/conductor.yaml). Live fleet e2e parked with `ops-gate0`.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness (no auth); database may be initializing |
| `GET` | `/ready` | Readiness / SQLite (no auth); 503 until DB answers |
| `POST` | `/api/auth/login` | Login -> { token } (JWT) |
| `GET` | `/api/auth/me` | Current identity |
| `GET` | `/api/services` | List all registered manager services |
| `GET` | `/api/services/:name` | Get one service |
| `POST` | `/api/services/:name/enable` | Enable/deploy a service for a project |
| `POST` | `/api/services/:name/disable` | Disable a service |
| `POST` | `/api/services/register` | Manager self-registration (service token issued) |
| `GET` | `/api/services/:name/health` | Proxy manager /health (auth; projectId optional via isLiveness) |
| `ANY` | `/api/services/:name/*` | Generic proxy (appProxyAuth: user\|app\|service); /health\|/ready skip projectId |
| `GET` | `/api/workers` | List workers |
| `GET` | `/api/workers/:id/host/check` | Host OS/Docker freshness |
| `POST` | `/api/workers/:id/host/check` | Re-probe host OS/Docker |
| `POST` | `/api/workers/:id/host/update` | Update host OS or Docker ({ target }) |
| `GET` | `/api/projects/:id/members` | List project friends/members (GA) |
| `POST` | `/api/projects/:id/members` | Add member (`user_id`, role); owner+ |
| `PATCH` | `/api/projects/:id/members/:userId` | Update member role; owner+ |
| `DELETE` | `/api/projects/:id/members/:userId` | Revoke member; owner+ |
| `POST` | `/api/projects/:id/members/leave` | Current user leaves project |
| `POST` | `/api/projects/:id/members/clear` | Owner clears membership (open project) |
| `GET` | `/api/projects/:id/invites` | List friend invites; owner+ |
| `POST` | `/api/projects/:id/invites` | Create invite token; owner+ |
| `DELETE` | `/api/projects/:id/invites/:inviteId` | Revoke invite; owner+ |
| `POST` | `/api/projects/invites/accept` | Accept invite `{ token }` |
| `GET` | `/api/federation/peer` | This conductor peer card (federation Preview) |
| `POST` | `/api/federation/peers` | Trust remote peer card |
| `GET` | `/api/federation/peers` | List trusted peers |
| `POST` | `/api/projects/:id/federation/grants` | Mint signed federation grant; owner+ |
| `POST` | `/api/federation/attach` | Accept grant → attach remote project |
| `GET` | `/api/federation/attaches` | List attached remote projects |
| `GET` | `/api/federation/attaches/:id/status` | `connecting` \| `active` \| `degraded` \| `disconnected` |
| `GET` | `/api/federation/attaches/:id/project` | Proxy GET home project |
| `DELETE` | `/api/federation/attaches/:id` | Detach |
| `GET` | `/api/projects/:id/iac/status` | IaC hookup status |
| `POST` | `/api/projects/:id/iac/hookup` | Hook up IaC ({ mode, repo }) |
| `GET` | `/api/projects/:id/stack` | Get project-stack JSON |
| `PUT` | `/api/projects/:id/stack` | Put project-stack JSON draft |
| `POST` | `/api/projects/:id/stack/apply` | Enable wanted[] then provision resources (never prod UUID) |
| `POST` | `/api/projects/:id/stack/diff` | Diff draft vs applied stack |
| `POST` | `/api/projects/:id/stack/rollback` | Roll back last applied stack revision |
| `GET` | `/api/projects/:id/edge/status` | Edge (tunnel/DNS) hookup status |
| `POST` | `/api/projects/:id/edge/hookup` | Hook up edge using existing Cloudflare secrets |
| `GET` | `/api/resources` | Fleet resource snapshot |
| `GET` | `/metrics` | Prometheus metrics |

## Environment

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Listen port |
| `JWT_SECRET` | `change-me` | Signs user JWTs |
| `TOKEN_SECRET` | `change-me` | Signs service tokens |
| `WORKER_REGISTRATION_TOKEN` | `-` | Token workers present to self-register |
| `DATABASE_PATH` | `/app/data/conductor.db` | SQLite path |

## Examples

**curl**

```bash
# login -> JWT
curl -s -X POST $CONDUCTOR/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'
```

**SDK (Node)**

```js
const { AerekosClient } = require('aerekos-sdk');
const client = new AerekosClient({ baseUrl: process.env.CONDUCTOR });
await client.auth.login('admin', 'admin');
console.log(await client.services.list());
```

**CLI**

```bash
aerekos login --url $CONDUCTOR -u admin -p admin
aerekos services
```

---

_Hand-aligned with `conductor/` for Wave 9 ops-conductor closeout. Catalog also lists `/ready` + proxy honesty in `docs/catalog.js`; re-run `make docs` carefully so this page stays accurate._

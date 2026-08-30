# conductor — Control plane (the AWS console + API)

> **Control plane** · Implemented

Master orchestrator: authentication, the service registry + proxy, worker fleet management, project scoping, and the React Native dashboard. Every client and SDK call enters here.

- **Port:** `3000`
- **AWS analog:** Control plane (the AWS console + API)
- **Proxy base:** `/api`
- **Capabilities:** `auth`, `service-registry`, `proxy`, `workers`, `projects`, `metrics`

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Liveness |
| `POST` | `/api/auth/login` | Login -> { token } (JWT) |
| `GET` | `/api/auth/me` | Current identity |
| `GET` | `/api/services` | List all registered manager services |
| `GET` | `/api/services/:name` | Get one service |
| `POST` | `/api/services/:name/enable` | Enable/deploy a service for a project |
| `POST` | `/api/services/:name/disable` | Disable a service |
| `POST` | `/api/services/register` | Manager self-registration (service token issued) |
| `ANY` | `/api/services/:name/*` | Generic proxy to a manager (JWT/service token) |
| `GET` | `/api/workers` | List workers |
| `GET` | `/api/workers/:id/host/check` | Host OS/Docker freshness |
| `POST` | `/api/workers/:id/host/check` | Re-probe host OS/Docker |
| `POST` | `/api/workers/:id/host/update` | Update host OS or Docker ({ target }) |
| `GET` | `/api/projects/:id/iac/status` | IaC hookup status |
| `POST` | `/api/projects/:id/iac/hookup` | Hook up IaC ({ mode, repo }) |
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

_Generated from `docs/catalog.js`. Edit the catalog and run `make docs` to update._

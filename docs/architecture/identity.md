# Identity model (W3)

Aerekos-cloud uses **three caller classes** at the conductor edge and on manager `:31xx` ports. Mixing them causes 401s that look alike unless you read `error.code` and `tokenType`.

## Token classes

| Class | How obtained | `typ` / shape | Verified by | Conductor `req.tokenType` |
|-------|----------------|---------------|-------------|---------------------------|
| **Human (console) JWT** | `POST /api/auth/login` | Conductor-signed user claims (`id`, `role`, …) | `JWTService` (conductor KMS) | `user` |
| **App credential JWT** | `POST …/auth_manager/…/token` `client_credentials` | `iss: aerekos-auth_manager`, `typ: app`, `project_id`, `resources`, `scope` | auth_manager `POST /api/v1/auth/verify` | `app` |
| **Service / worker token** | Service registry `service_token`, or `WORKER_TOKEN` / `CONDUCTOR_TOKEN` | Opaque string or registry UUID | Conductor DB / env allowlist | `service` |

**Device / fleet** workers use **service tokens** (registration token from `GET /api/token` with admin JWT, or shared worker env tokens) for conductor APIs—not human JWTs and not app credentials.

Icarus automation and SDK flows should prefer **app credentials** scoped to a project. The dashboard uses **human JWTs**. Never paste console JWTs into `AEREKOS_CLIENT_SECRET` or env vars meant for client credentials.

## Conductor proxy (`appProxyAuth`)

Path: `conductor/api/middleware/appProxyAuth.js`.

Classification order:

1. Missing `Authorization` → standard `authenticate` (401 `No token provided`).
2. Bearer matches a **registered service token** → `tokenType: service`, forward unchanged.
3. Bearer matches **worker allowlist** env tokens → `tokenType: service`.
4. JWT decodes with `iss === aerekos-auth_manager` and `typ === app` → **verify** with auth_manager; on success set `req.auth`, `req.isAppCredential`, forward **without** swapping to a conductor-minted token.
5. Otherwise → **human JWT** via `authenticate`; set `tokenType: user`.

App credentials are **never** exchanged for conductor user JWTs at the proxy (W3 / platform app access).

### Error codes (edge)

| Code | Meaning | Typical fix |
|------|---------|-------------|
| `InvalidAppToken` | Bearer is an app-shaped JWT (`iss` + `typ: app`) but verify failed (revoked, expired, auth_manager down, `AUTH_MANAGER_URL` unset on conductor). | Re-mint client_credentials token; check auth_manager health and conductor env. |
| `WrongTokenType` | JWT issuer/`typ` does not match the path (e.g. auth_manager token without `typ: app`, or `typ: app` with wrong `iss`). | Use login JWT for console routes; use client_credentials for manager proxy / Icarus C0. |
| (human path) `Invalid token` | Conductor could not verify user JWT (wrong secret, expired, malformed). | Re-login; check KMS / `JWT_SECRET` alignment with auth_manager rollout. |

`InvalidAppToken` is **only** for verified app-credential shape at the proxy. It does **not** mean “use a different manager port”—it means auth_manager rejected or could not validate that app JWT.

### IAM at the edge

| Middleware | Applies to | Deny shape |
|------------|------------|--------------|
| `requireArnScope` | App credentials | 403 `ResourceNotAllowed` / `InsufficientScope` |
| `requireIamAccess` | Human JWT when `IAM_ENFORCE_PROXY=true` | 403 `IamDenied` (via `iam_manager` evaluate) |

App credentials use **credential `resources` + scope** at managers and optional `requireArnScope` on the conductor. Humans use **IAM roles** when enforcement is on.

## Manager direct ports (`AUTH_REQUIRED`)

Managers use `worker/shared/authManagerClient.js`:

- `AUTH_REQUIRED=true` → every route needs a valid Bearer (app or service token verified by auth_manager, per manager wiring).
- `AUTH_REQUIRED` not `true` → homelab **best-effort**: valid tokens attach `req.auth` but unauthenticated calls may still hit the handler (direct `:31xx` bypass risk).

Prod compose should keep `AUTH_REQUIRED=true` on gated managers. See [auth-required runbook](../runbooks/auth-required.md).

## Related docs

| Doc | Topic |
|-----|--------|
| [mixed-stack.md](../runbooks/mixed-stack.md) | Live `appProxyAuth` bind mount |
| [icarus-c0.md](../runbooks/icarus-c0.md) | App token env for C0 |
| [platform_app_access.md](../plans/platform_app_access.md) | ARN, scope, phased rollout |
| [threat-model.md](../threat-model.md) | Direct-port bypass, placeholder secrets |

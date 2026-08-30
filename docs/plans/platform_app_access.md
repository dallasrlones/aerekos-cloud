# Platform app access — ARN + credentials (shared auth model)

> **Status:** Approved direction — implementation not started  
> **Last updated:** 2026-06-06  
> **Navigation:** [Index](./README.md) · [Next: conductor →](./conductor.md)  
> **Quality bar:** [enterprise_standards.md](./enterprise_standards.md) — CLI ↔ console ↔ API parity required.  
> **Scope:** Shared platform auth for **all** app-callable managers. AI Manager is the reference — see [ai_manager.md](./ai_manager.md).

---

## Goals

1. **Resources with ARNs** — Every app-facing resource (AI endpoint, bucket, database, repo, etc.) gets a stable AWS-style ARN at create time.
2. **Credentials via auth_manager** — Apps authenticate once with `auth_manager` (`client_credentials`); tokens carry `project_id`, `resources[]`, and `scope`.
3. **Invoke URLs** — Console shows ARN + token URL + invoke URL + example curl when a credential is created.
4. **Conductor as gateway** — Validates app JWT, enforces ARN scope at the edge, forwards the **app token** (not the conductor service token) to managers.
5. **Manager enforcement** — Each gated manager resolves ARN → resource config and rejects out-of-scope calls.
6. **Same pattern everywhere** — `storage_manager`, `db_manager`, `compute_manager`, `git_manager`, etc. adopt the same primitives; AI Manager is the reference implementation.

**Todo registry:** [MASTER_TODOS.md](./MASTER_TODOS.md) — `p0-primitives` through `p10-hardening`.

---

## Architecture

```
┌─────────────┐     client_credentials      ┌──────────────────┐
│  Your app   │ ──────────────────────────► │  auth_manager    │
│             │ ◄────────────────────────── │  POST /auth/token│
└──────┬──────┘     JWT (resources, scope) └──────────────────┘
       │
       │  Bearer <app-jwt>
       │  { resource: "arn:aerekos:…" }  OR  ?project_id=
       ▼
┌──────────────────┐   forward app JWT    ┌─────────────────┐
│  conductor       │ ────────────────────► │  ai_manager     │
│  proxy + scope   │   (no token swap)    │  ARN → backend  │
└──────────────────┘                       └─────────────────┘
```

### Auth planes (keep separate)

| Plane | Issuer | Used by |
|-------|--------|---------|
| **Human** | Conductor (`JWT_SECRET`) | Dashboard login, admin ops |
| **Machine (app)** | auth_manager | Apps, automation, CI |
| **Service-to-service** | Conductor service registry token OR auth_manager `conductor` client | Worker registration, internal calls |

### Current gap (must fix)

Today, when a user JWT hits `/api/services/ai_manager/api/*`, conductor replaces the caller token with an auth_manager token minted for the `conductor` client (`authManagerToken.js`). **App identity and ARN scope are lost.** Phase 2 below fixes this.

---

## ARN specification (platform-wide)

### Format

```
arn:aerekos:{project_id}:{namespace}:{resource_type}/{name}
```

- `{project_id}` — UUID of the project (required for tenant isolation).
- `{namespace}` — Manager domain (`ai`, `storage`, `db`, `compute`, `git`, …).
- `{resource_type}` — Resource kind within that namespace.
- `{name}` — User-chosen slug (URL-safe: `[a-z0-9][a-z0-9-_]{0,63}`).

### Wildcards (for iam_manager policies)

```
arn:aerekos:{project_id}:ai:llm:endpoint/*
arn:aerekos:{project_id}:ai:*:endpoint/*
arn:aerekos:{project_id}:storage:bucket/*
```

### AI Manager ARNs (reference)

| Capability | ARN pattern | Example |
|------------|-------------|---------|
| LLM | `arn:aerekos:{pid}:ai:llm:endpoint/{name}` | `…/my-prod-llm` |
| TTS | `arn:aerekos:{pid}:ai:tts:endpoint/{name}` | `…/my-voice` |
| STT | `arn:aerekos:{pid}:ai:stt:endpoint/{name}` | `…/my-transcribe` |
| Embeddings | `arn:aerekos:{pid}:ai:embeddings:endpoint/{name}` | `…/my-embed` |

### Other services (same pattern, phased rollout)

| Service | Namespace | Resource type | Example ARN |
|---------|-----------|---------------|-------------|
| `storage_manager` | `storage` | `bucket` | `arn:aerekos:{pid}:storage:bucket/uploads` |
| `db_manager` | `db` | `database` | `arn:aerekos:{pid}:db:database/analytics` |
| `secrets_manager` | `secrets` | `secret` | `arn:aerekos:{pid}:secrets:secret/api-key` |
| `compute_manager` | `compute` | `task` | `arn:aerekos:{pid}:compute:task/batch-etl` |
| `git_manager` | `git` | `repository` | `arn:aerekos:{pid}:git:repository/my-app` |
| `queue_manager` | `queue` | `queue` | `arn:aerekos:{pid}:queue:queue/jobs` |
| `webhook_manager` | `webhook` | `endpoint` | `arn:aerekos:{pid}:webhook:endpoint/stripe` |

Managers that are **admin-only** or **infra-internal** (`key_manager`, `host_manager`, `worker_manager`) stay on conductor JWT / service tokens only — no app credentials.

---

## Credential model (auth_manager)

### Resource: Credential

Project-scoped machine identity for apps (AWS IAM access key analog — **not** OIDC IdP).

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `project_id` | Owning project |
| `name` | Display name (`my-mobile-app`) |
| `client_id` | Public id (`cred_…`) |
| `client_secret_hash` | bcrypt; plaintext shown once on create |
| `allowed_resources` | `string[]` of ARNs (exact or stored patterns) |
| `scopes` | `string[]` e.g. `ai:InvokeLlm`, `storage:GetObject` |
| `enabled` | `true` / `false` |
| `created_at` / `last_used_at` | Audit |

### Token claims (JWT from `POST /api/v1/auth/token`)

```json
{
  "iss": "aerekos-auth_manager",
  "sub": "cred:{credential_id}",
  "typ": "app",
  "project_id": "d57d380d-…",
  "resources": ["arn:aerekos:…:ai:llm:endpoint/my-prod-llm"],
  "scope": "ai:InvokeLlm ai:InvokeEmbeddings",
  "aud": "aerekos"
}
```

### API (auth_manager)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/credentials` | Create credential (`project_id`, `name`, `allowed_resources`, `scopes`) → `{ client_id, client_secret }` once |
| `GET` | `/api/v1/credentials?project_id=` | List (no secrets) |
| `GET` | `/api/v1/credentials/:id` | Get one |
| `PATCH` | `/api/v1/credentials/:id` | Update resources/scopes/enabled |
| `DELETE` | `/api/v1/credentials/:id` | Revoke |
| `POST` | `/api/v1/credentials/:id/rotate` | New secret, invalidate old |

Existing routes unchanged:

- `POST /api/v1/auth/token` — extend to load dynamic credentials from DB (not only `AUTH_CLIENTS` env).
- `POST /api/v1/auth/verify` — already used by `worker/shared/authManagerClient.js`.

---

## Scope naming convention

Pattern: `{namespace}:{Action}`

### AI Manager

| Scope | Allows |
|-------|--------|
| `ai:InvokeLlm` | `POST /api/v1/llm/chat`, `/generate` |
| `ai:InvokeEmbeddings` | `POST /api/v1/embeddings` |
| `ai:InvokeTts` | `POST /api/v1/tts/synthesize` |
| `ai:InvokeStt` | `POST /api/v1/stt/transcribe*` |
| `ai:ManageEndpoints` | CRUD `/api/v1/providers` (human/admin; optional on credentials) |

### Storage (future)

`storage:GetObject`, `storage:PutObject`, `storage:ListBucket`, `storage:DeleteObject`

### DB (future)

`db:Connect`, `db:Query`, `db:Admin`

---

## Invoke URLs

### Phase 1 (ship first) — conductor proxy + body/header ARN

```
Token URL:  https://cloudapi.aerekos.com/api/services/auth_manager/api/v1/auth/token
Invoke URL: https://cloudapi.aerekos.com/api/services/ai_manager/api/v1/llm/chat
Body:       { "resource": "arn:aerekos:…:ai:llm:endpoint/my-prod-llm", "model": "…", "messages": […] }
Header alt: X-Aerekos-Resource: arn:aerekos:…
```

Backward compatible: `integration` + `project_id` still work for conductor-user JWT; app credentials **must** use `resource` (ARN).

### Phase 2 (later) — api_manager pretty paths

```
https://cloudapi.aerekos.com/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat
```

ARN remains the identity; URL is routing sugar.

---

## Shared platform modules

New / extended code used by **all** adopting managers:

| Module | Path | Purpose |
|--------|------|---------|
| ARN utils | `worker/shared/arn.js` | `buildArn`, `parseArn`, `matchesResource(allowed, requested)` |
| Scope utils | `worker/shared/scope.js` | `hasScope(claims, required)` |
| Auth client | `worker/shared/authManagerClient.js` | Extend `requireAuth` to attach `req.auth`, `req.projectId`, `req.resources` |
| Resource guard | `worker/shared/requireResource.js` | Middleware: extract ARN from body/header/query, check against `req.auth.resources` |
| Conductor edge | `conductor/api/middleware/appProxyAuth.js` | Accept user JWT **or** auth_manager app JWT **or** service token; never swap app tokens |
| Conductor scope | `conductor/api/middleware/requireArnScope.js` | Optional edge enforcement before proxy |
| ARN registry | `docs/catalog.js` | Per-service `arnNamespace`, `arnResourceTypes`, `appScopes` metadata |

### Conductor proxy rules

1. **User JWT** (dashboard) → proxy as today; may use conductor-minted token only for legacy managers not yet on app-auth.
2. **App JWT** (`typ: app` from auth_manager) → **forward unchanged**; set `req.auth`, `req.isAppCredential = true`.
3. **Service token** (registry) → forward for worker-to-worker.
4. `AUTH_MANAGER_GATED_SERVICES` → stop replacing token when incoming token is already an auth_manager JWT with `typ: app`.

---

## AI Manager changes

### Rename: Integrations → Endpoints

- DB model `AiModelConfig` (table may stay); add column `arn` (unique per project).
- Auto-generate ARN on create from `project_id` + `capability` + `name`.
- Routes: keep `/api/v1/providers` internally; alias `/api/v1/endpoints` in API + UI.
- Response always includes `arn`, `invoke_path`, `invoke_url` (computed from conductor public URL env).

### Inference routes

All of `llm.js`, `tts.js`, `stt.js`, `embeddings.js`:

1. Accept `resource` (ARN) **or** `integration` (name) + `project_id`.
2. Resolve ARN → endpoint row via `ProviderResolver`.
3. `requireResource` + `hasScope` for app tokens.
4. Human JWT via conductor: full project access (existing behavior).

### UI (`conductor/app/screens/AIManager/`)

- Tab: **Endpoints** (rename from Integrations).
- List/detail: show ARN, capability, backend, invoke snippet.
- Tab: **Credentials** (calls auth_manager via conductor proxy).
- **App access** panel: copy ARN, token curl, invoke curl.
- `authManagerService.js` + `aiManagerService.js` client updates.

---

## Implementation phases & tasks

### Phase 0 — Platform primitives

- [ ] **P0.1** Add `worker/shared/arn.js` — build, parse, wildcard match
- [ ] **P0.2** Add `worker/shared/scope.js` — scope check helper
- [ ] **P0.3** Add `worker/shared/requireResource.js` — Express middleware
- [ ] **P0.4** Extend `authManagerClient.requireAuth` — expose `req.auth.typ`, `project_id`, `resources`, `scope`
- [ ] **P0.5** Document ARN + scope conventions in `docs/catalog.js` (`arnNamespace`, `appScopes` per service)
- [ ] **P0.6** Unit tests for `arn.js` and `scope.js`

### Phase 1 — auth_manager Credentials

- [ ] **P1.1** Persistence: `Credential` model (SQLite via aerekos-record), project-scoped
- [ ] **P1.2** `CredentialService` — CRUD, bcrypt secret, rotate, revoke
- [ ] **P1.3** Routes `/api/v1/credentials` (+ tests)
- [ ] **P1.4** Extend `TokenService.issueClientToken` — dynamic DB clients + claims (`typ`, `project_id`, `resources`, `scope`)
- [ ] **P1.5** Update `worker/auth_manager/plan.md` — mark credentials phase
- [ ] **P1.6** Conductor proxy route for `auth_manager` credentials (user JWT only for CRUD)
- [ ] **P1.7** Integration test: create credential → token → verify claims

### Phase 2 — Conductor edge auth

- [ ] **P2.1** Add `conductor/api/middleware/appProxyAuth.js` — detect token type (user / app / service)
- [ ] **P2.2** Update `conductor/api/routes/services.js` — app JWT passthrough for gated services (no `authManagerToken` swap)
- [ ] **P2.3** Add `requireArnScope` middleware (optional per-route) for conductor edge
- [ ] **P2.4** Env docs: `AUTH_MANAGER_GATED_SERVICES`, `PUBLIC_API_URL` for invoke URL generation
- [ ] **P2.5** Integration test: app token reaches ai_manager with same `sub`, not `conductor`

### Phase 3 — AI Manager Endpoints + ARN

- [ ] **P3.1** Migration: add `arn` column to `AiModelConfig`; backfill on read
- [ ] **P3.2** `ArnService` or helpers in `AiProviderService` — generate on create
- [ ] **P3.3** API responses include `arn`, `invoke_url`; alias `/api/v1/endpoints`
- [ ] **P3.4** `ProviderResolver` — resolve by ARN or integration name
- [ ] **P3.5** Update seed-local to set ARNs on default Orin endpoints

### Phase 4 — AI Manager scope enforcement

- [ ] **P4.1** Wire `requireResource` + `hasScope` on `llm`, `tts`, `stt`, `embeddings` routes
- [ ] **P4.2** Accept `resource` in body; header `X-Aerekos-Resource`
- [ ] **P4.3** Return `403` with ARN in error when scope/resource mismatch
- [ ] **P4.4** Integration tests: credential scoped to one endpoint cannot call another

### Phase 5 — Console UI

- [ ] **P5.1** Rename Integrations → Endpoints in `AIManager.jsx`
- [ ] **P5.2** ARN column + copy button in endpoint list/detail
- [ ] **P5.3** Credentials tab — list/create/revoke via auth_manager proxy
- [ ] **P5.4** App access card — token URL, invoke URL, curl templates
- [ ] **P5.5** `authManagerService.js` — credentials CRUD client
- [ ] **P5.6** Optional: Credentials section in `AuthManager` screen for non-AI credentials

### Phase 6 — Platform rollout (other managers)

Apply the same pattern per service (can be parallelized after Phase 0–2):

| Service | Tasks |
|---------|-------|
| **storage_manager** | ARN on bucket create; scopes `storage:*`; `requireResource` on object routes |
| **db_manager** | ARN on database provision; `db:Connect` scope |
| **secrets_manager** | ARN per secret; tight scopes `secrets:GetValue` |
| **compute_manager** | ARN per task template; `compute:Run` |
| **git_manager** | ARN per repo; `git:Read`, `git:Push` |
| **queue_manager** | ARN per queue; `queue:Send`, `queue:Receive` |
| **webhook_manager** | ARN per inbound endpoint |

- [ ] **P6.1** Add `arn` + invoke metadata to each service's create path
- [ ] **P6.2** Adopt `requireAuth` + `requireResource` from `worker/shared`
- [ ] **P6.3** Register scopes in `docs/catalog.js`
- [ ] **P6.4** Console: per-manager "App access" where applicable

### Phase 7 — iam_manager integration

- [ ] **P7.1** Policy document `resources: ["arn:…"]` validation against ARN spec
- [ ] **P7.2** Optional: attach iam policy to credential instead of inline `allowed_resources`
- [ ] **P7.3** Conductor: evaluate iam policy for user JWT; keep credential `allowed_resources` for app JWT (MVP)

### Phase 8 — DX & docs

- [ ] **P8.1** Update `docs/services/ai_manager.md` + catalog endpoints (`/providers`, `/endpoints`, credentials)
- [ ] **P8.2** `aerekos-sdk` — `getToken()`, `invoke({ resource, … })` helpers
- [ ] **P8.3** `aerekos` CLI — `aerekos cred create`, `aerekos ai invoke --resource arn:…`
- [ ] **P8.4** E2E: `e2e/` scenario — credential → LLM chat via public API

### Phase 9 — api_manager pretty URLs (optional / later)

- [ ] **P9.1** Route templates mapping path → ARN
- [ ] **P9.2** Public invoke URLs in credential card

### Phase 10 — Production hardening (added from full codebase audit)

- [ ] **P10.1** `AUTH_REQUIRED=true` for all managers in prod compose (`scripts/generate-full-stack.mjs`)
- [ ] **P10.2** Unify manager auth: replace ad-hoc JWT/service-token middleware with `authManagerClient.requireAuth`
- [ ] **P10.3** git_manager Smart HTTP: auth via auth_manager token (replace standalone `GIT_AUTH_TOKEN`)
- [ ] **P10.4** Rate limits: `/api/auth/login`, `/auth/token`, inference invoke routes
- [ ] **P10.5** Audit log: credential lifecycle, `secrets_manager?reveal=1`, admin login failures
- [ ] **P10.6** Prod secrets: rotate `JWT_SECRET`, `AUTH_MANAGER_SECRET`, `MASTER_KEY`; no dev fallbacks
- [ ] **P10.7** `MOCK_KEY_MANAGER=false` for storage_manager + secrets_manager in prod
- [ ] **P10.8** Per-project service enablement UX (all managers seed `enabled: 0` in `seedServices.js`)
- [ ] **P10.9** e2e Tier 6: app credential → scoped invoke (ai, storage, db)
- [ ] **P10.10** `aerekos-sdk`: `getAppToken()`, `invoke({ resource })`, credential CRUD helpers
- [ ] **P10.11** Split-host docs: Orin `SECRETS_MANAGER_URL` / `CONDUCTOR_URL` = LAN HTTP only
- [ ] **P10.12** Direct-port `:31xx` auth audit — no unauthenticated manager APIs in prod network

---

## Per-manager rollout index

After Phase 0–2, apply app-access tasks in each plan:

| Manager | Plan |
|---------|------|
| ai_manager (reference) | [ai_manager.md](./ai_manager.md) |
| storage_manager | [storage_manager.md](./storage_manager.md) |
| db_manager | [db_manager.md](./db_manager.md) |
| secrets_manager | [secrets_manager.md](./secrets_manager.md) |
| compute_manager | [compute_manager.md](./compute_manager.md) |
| queue_manager | [queue_manager.md](./queue_manager.md) |
| webhook_manager | [webhook_manager.md](./webhook_manager.md) |
| git_manager | [git_manager.md](./git_manager.md) |

Admin-only (no app credentials): [key_manager](./key_manager.md), [iam_manager](./iam_manager.md), [tunnel_manager](./tunnel_manager.md), [domain_manager](./domain_manager.md), [conductor](./conductor.md).

---

## Key files to touch

```
worker/shared/arn.js                          (new)
worker/shared/scope.js                        (new)
worker/shared/requireResource.js              (new)
worker/shared/authManagerClient.js            (extend)
worker/auth_manager/api/models/               (Credential)
worker/auth_manager/api/services/CredentialService.js
worker/auth_manager/api/services/TokenService.js
worker/auth_manager/api/routes/credentials.js
worker/ai_manager/api/services/AiProviderService.js
worker/ai_manager/api/services/ProviderResolver.js
worker/ai_manager/api/routes/*.js
conductor/api/middleware/appProxyAuth.js      (new)
conductor/api/middleware/requireArnScope.js   (new)
conductor/api/routes/services.js
conductor/app/screens/AIManager/
conductor/app/services/authManagerService.js
docs/catalog.js
```

---

## Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `AUTH_MANAGER_URL` | conductor, workers | Token mint + verify |
| `AUTH_REQUIRED` | per manager | Enforce auth_manager on routes |
| `AUTH_MANAGER_GATED_SERVICES` | conductor | Services that accept app JWT (don't swap token) |
| `PUBLIC_API_URL` | conductor, ai_manager | Build invoke URLs (`https://cloudapi.aerekos.com`) |
| `CONDUCTOR_CLIENT_SECRET` | conductor, auth_manager | Internal `conductor` client only |

**Orin / Jetson:** `SECRETS_MANAGER_URL` and `CONDUCTOR_URL` must stay on **LAN HTTP** — never `https://cloudapi` on device.

---

## Testing checklist

- [ ] Create endpoint → ARN appears and is stable across edits (name change updates ARN or rejects — **decision: ARN immutable, name slug locked at create**)
- [ ] Create credential with one ARN → token mint succeeds
- [ ] Token without scope → `403` on inference
- [ ] Token with scope but wrong ARN → `403`
- [ ] Dashboard user JWT → still works for all endpoints in project
- [ ] Conductor does not replace app JWT with conductor client token
- [ ] Revoked credential → `401` on token mint
- [ ] Cross-project ARN → `403`

---

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Resource naming in UI | **Endpoint** (not Integration) |
| Machine identity naming | **Credential** (not OIDC Provider) |
| ARN in invoke | **Body/header first** (`resource` field); pretty URLs later |
| Token issuer | **auth_manager only** for apps |
| Credential storage | **auth_manager** (not per-manager API keys) |
| ARN immutability | ARN set at create; deleting endpoint revokes use; renaming slug requires new resource |

---

## References

- [Plans index](./README.md)
- [conductor.md](./conductor.md) · [auth_manager.md](./auth_manager.md) · [iam_manager.md](./iam_manager.md)
- [ai_manager.md](./ai_manager.md) — reference implementation tasks
- [docs/services/ai_manager.md](../services/ai_manager.md) — user-facing API doc
- `worker/shared/authManagerClient.js` — shared verify middleware
- `conductor/api/utils/authManagerToken.js` — current conductor swap (to be bypassed for app JWT)

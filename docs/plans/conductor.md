# conductor — production plan

**Port:** 3000 · **AWS analog:** Control plane (console + API) · **Tier:** production-ready (core complete; app-access gaps remain)

**Navigation:** [← platform_app_access](./platform_app_access.md) · [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [auth_manager →](./auth_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Master orchestrator: user JWT auth, service registry + proxy to all managers, worker fleet, projects, releases, WebSocket metrics, React Native dashboard.

Legacy plan marked **COMPLETE** in `conductor/plan.md` — this doc covers **production gaps** discovered in the 2026-06 audit.

## Current state

| Area | Status |
|------|--------|
| Backend API | Complete — proxy, workers, projects, auth |
| Frontend | 7 bespoke manager screens + generic ManagerConsole |
| Tests | ~16 test files; plan claims 96 passing |
| Proxy auth | `serviceProxyAuth`: service token OR user JWT |
| App credentials | **Not implemented** |
| IAM enforcement | **Not implemented** |

### Known gaps

- `authManagerToken.js` replaces caller JWT with `conductor` client token for `ai_manager` — **loses app identity**
- `iam_manager` policies stored but never evaluated at proxy
- All 34 managers seed `enabled: 0` — must enable per project before use
- Default `JWT_SECRET` / dev secrets in compose templates
- No rate limiting on login or proxy
- `conductor/plan.md` does not reflect ARN/credential roadmap

## App access

**Admin-only.** Conductor issues human JWTs; apps use auth_manager credentials. Conductor must **validate and forward** app JWTs — see [platform_app_access.md](./platform_app_access.md) Phase 2.

---

## Production tasks

### Phase A — App proxy auth (p2-conductor)

- [ ] **p2-conductor** Add `conductor/api/middleware/appProxyAuth.js` — classify token: `user` | `app` | `service`
- [ ] Detect auth_manager JWT (`iss: aerekos-auth_manager`, `typ: app`)
- [ ] **Do not** call `authManagerToken.getToken()` when incoming token is app JWT
- [ ] Attach `req.auth`, `req.isAppCredential`, `req.tokenType` for downstream proxy
- [ ] Replace `serviceProxyAuth` on gated manager routes with `appProxyAuth`
- [ ] Integration test: app token `sub` preserved through proxy to ai_manager

### Phase B — ARN scope at edge

- [ ] Add `conductor/api/middleware/requireArnScope.js`
- [ ] Extract `resource` ARN from body / `X-Aerekos-Resource` header before proxy
- [ ] For app JWT: verify ARN ∈ `claims.resources` and scope matches route
- [ ] For user JWT: optional iam_manager policy check (Phase C)
- [ ] Return `403` with clear ARN/scope error JSON

### Phase C — IAM enforcement

- [ ] Add `conductor/api/services/PolicyEvaluator.js`
- [ ] On user JWT proxy: load user's roles → policies → evaluate `Action` + `Resource` ARN
- [ ] Cache policy evaluations (short TTL)
- [ ] Wire iam_manager deny/allow semantics
- [ ] Tests: allow read, deny delete, cross-project deny

### Phase D — Invoke URL generation

- [ ] `PUBLIC_API_URL` env (`https://cloudapi.aerekos.com`)
- [ ] Helper `buildInvokeUrl(manager, path, projectId)` for credential cards
- [ ] Pass invoke metadata in proxy responses where managers return ARN

### Phase E — Operations & hardening

- [ ] Service enablement wizard in ProjectDetails (enable common managers in one click)
- [ ] Rate limit `POST /api/auth/login` and proxied `/auth/token`
- [ ] Audit log table: login, credential CRUD (via auth_manager webhook or direct)
- [ ] Fail deploy if `JWT_SECRET` is default in prod role
- [ ] Document `SERVICE_DIRECT_HOSTS` for prod/orin split in DEPLOYMENT.md
- [ ] Health dashboard: aggregate manager `/metrics` for enabled services
- [ ] Update `conductor/plan.md` — add "Phase 8: App access" section pointing here

### Phase F — Releases & fleet

See [release_fleet.md](./release_fleet.md) — todos `release-fleet-1` … `release-fleet-5`.

- [ ] **release-fleet-1** Publish pipeline + CI `publish.sh` wiring
- [ ] **release-fleet-2** UpdateService poll + updater sidecar verified prod + Orin
- [ ] **release-fleet-3** agentAuth hardening + audit fleet updates
- [ ] **release-fleet-4** Version drift in Devices UI + rollback/pin
- [ ] **release-fleet-5** Post-update e2e Tier 1–4 gate
- [ ] WebSocket worker metrics under load

### Phase L — Project onboarding

See [project_onboarding.md](./project_onboarding.md) — todos `cc-project-1` … `cc-project-4`.

- [ ] **cc-project-1** Project create → default VPC/network hook
- [ ] **cc-project-2** Enable core stack toggle (key → secrets → auth → storage)
- [ ] **cc-project-3** Dashboard setup % badge
- [ ] **cc-project-4** `aerekos project create --enable-core` CLI

### Phase M — Alerts

See [observability_alerts.md](./observability_alerts.md) — todos `cc-alerts-1` … `cc-alerts-4`.

- [ ] **cc-alerts-1** AlertService rules (manager unhealthy >5m, worker heartbeat)
- [ ] **cc-alerts-2** Deliver via webhook_manager + runbook links in payload
- [ ] **cc-alerts-3** Dashboard incident banner (Animus)

### Phase K — Headscale VPC (fleet overlay)

See [vpc_network.md](./vpc_network.md).

- [ ] `HeadscaleService` — preauth key mint/revoke, node mapping on Worker model
- [ ] Worker register returns one-time `tailscale_authkey` (or inject via deploy)
- [ ] Service registry returns overlay hostnames (MagicDNS)

### Phase J — Service setup wizards

See [service_setup_wizard.md](./service_setup_wizard.md).

- [ ] `SetupReadinessService` + `GET /api/services/:name/setup` + `GET /api/setup/graph`
- [ ] Dependency + secret + probe status (connected / misconfigured / missing / deferred)

### Phase I — Global search (AWS/GCP command palette)

See [global_search.md](./global_search.md).

- [ ] Phase 1: Clickable header search + `GlobalSearch` modal + ⌘K/Ctrl+K
- [ ] Phase 2: Index `SERVICE_CATALOG` + actions + fuzzy match + navigate
- [ ] Phase 3: `GET /api/search` resource aggregator (project-scoped)
- [ ] Phase 4: Recent items, keyboard nav, mobile sheet, CLI `aerekos search`

### Phase H — API standards (enterprise)

- [ ] `X-Request-Id` middleware on all proxy responses
- [ ] Uniform error envelope `{ error: { code, message, request_id } }`
- [ ] `Idempotency-Key` on POST creates (24h cache)
- [ ] `GET /api/audit?project_id=` — CloudTrail-equivalent
- [ ] Cursor pagination helper for proxy list routes

### Phase G — Testing

- [ ] e2e Tier 6: create credential → invoke ai_manager via `cloudapi`
- [ ] Integration: iam policy deny blocks user JWT proxy
- [ ] Regression: dashboard login + ai_manager still works after appProxyAuth

---

## Key files

```
conductor/api/middleware/appProxyAuth.js       (new)
conductor/api/middleware/requireArnScope.js  (new)
conductor/api/middleware/serviceProxyAuth.js   (extend or replace)
conductor/api/routes/services.js
conductor/api/utils/authManagerToken.js
conductor/api/services/PolicyEvaluator.js      (new)
conductor/scripts/seedServices.js
conductor/app/screens/ProjectDetails/
```

---

## Links

- Legacy plan: [conductor/plan.md](../../conductor/plan.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)
- Service doc: [docs/services/conductor.md](../services/conductor.md)

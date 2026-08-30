# ai_manager — production plan

**Port:** 3126 · **AWS analog:** Bedrock + Polly + Transcribe + Embeddings · **Tier:** real API (advanced); app-access not built

**Navigation:** [← auth_manager](./auth_manager.md) · [Index](./README.md) · [iam_manager →](./iam_manager.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md) — **reference implementation**  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

GPU-accelerated AI on worker nodes: Ollama LLM + embeddings, TTS (cache/kokoro/xtts), STT (whisper). Project-scoped **Endpoints** (today: "integrations" / `AiModelConfig`). Local fleet only — no third-party API providers.

**Prod topology:** GPU on Orin (`orin.aerekos.com`); conductor on prod reaches ai_manager via `SERVICE_DIRECT_HOSTS` LAN map.

## Current state

| Area | Status |
|------|--------|
| Inference | Working — llm, tts, stt, embeddings via `ProviderResolver` |
| Endpoints CRUD | `/api/v1/providers` + seed-local + test |
| Auth | `requireAuth()` on inference routes; `AUTH_REQUIRED=true` on Orin AI stack |
| Conductor proxy | Swaps token to `conductor` client — **breaks app identity** |
| ARN / credentials | **Not implemented** |
| Console | `AIManager.jsx` — Integrations tab, capability pickers |
| Tests | `crud.test.js` + health; **no inference integration tests** |
| Catalog | Missing `/providers` endpoints; says "not project-scoped" (wrong) |

### Known gaps

- No ARN on endpoint create
- Conductor token swap (`authManagerToken.js`)
- `/api/v1/models` CRUD unauthenticated on direct port
- No scoped app credential enforcement
- Orin must use LAN HTTP for `SECRETS_MANAGER_URL` (Jetson TLS issue)
- No streaming LLM response in UI (API may support — verify)

## App access

**Primary reference** for [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:ai:{capability}:endpoint/{name}` |
| Capabilities | `llm`, `tts`, `stt`, `embeddings` |
| Scopes | `ai:InvokeLlm`, `ai:InvokeTts`, `ai:InvokeStt`, `ai:InvokeEmbeddings` |
| Token URL | `{PUBLIC_API_URL}/api/services/auth_manager/api/v1/auth/token` |
| Invoke (LLM) | `{PUBLIC_API_URL}/api/services/ai_manager/api/v1/llm/chat` |

---

## Production tasks

### Depends on (do first)

- [platform_app_access.md](./platform_app_access.md) Phase 0–2 (shared modules + credentials + conductor passthrough)
- [auth_manager.md](./auth_manager.md) Credentials CRUD
- [conductor.md](./conductor.md) appProxyAuth

### Phase 1 — Endpoints + ARN

- [ ] Add `arn` column to `AiModelConfig`; immutable at create
- [ ] `buildArn(project_id, capability, name)` via `worker/shared/arn.js`
- [ ] Include `arn`, `invoke_path`, `invoke_url` in all provider responses
- [ ] Alias routes: `/api/v1/endpoints` → same handlers as `/providers`
- [ ] `ProviderResolver`: resolve by `resource` (ARN) or `integration` (name)
- [ ] `seed-local`: ARNs on 6 default Orin endpoints
- [ ] Backfill ARN on read for existing rows

### Phase 2 — Scope enforcement

- [ ] `requireResource` + `hasScope` on `llm.js`, `tts.js`, `stt.js`, `embeddings.js`
- [ ] Accept `resource` in body; `X-Aerekos-Resource` header
- [ ] App JWT (`typ: app`): enforce ARN + scope
- [ ] User JWT (via conductor): full project access (no ARN required)
- [ ] `403` with `{ error, resource, required_scope }` on mismatch
- [ ] `requireAuth` on `/providers` and `/models` when `AUTH_REQUIRED=true`

### Phase 3 — Console UI

- [ ] Rename **Integrations** → **Endpoints**
- [ ] ARN column + copy in list/detail
- [ ] **Credentials** tab → auth_manager proxy
- [ ] **App access** card per endpoint: ARN, token curl, invoke curl
- [ ] `authManagerService.js` — credentials client
- [ ] Update `guides.js` — ARN-based examples only

### Phase 4 — Testing & docs

- [ ] Integration: credential scoped to `my-prod-llm` cannot call `my-voice`
- [ ] Integration: full flow token → chat → 200
- [ ] Update `docs/catalog.js` — project-scoped, `/providers`, `/endpoints`, scopes
- [ ] `make docs` regen `docs/services/ai_manager.md`
- [ ] e2e Tier 6 scenario in `e2e/run.js`

### Phase 5 — CLI & click ops parity

- [ ] `aerekos ai_manager endpoints list|create|test|delete`
- [ ] `aerekos cred create` + `aerekos invoke --resource arn:…`
- [ ] Console ActionBar: Copy ARN, Copy CLI, Copy curl (app + admin)
- [ ] `aerekos wizard endpoint` — guided setup
- [ ] OpenAPI fragment `docs/openapi/ai_manager.yaml`

### Phase 6 — Production ops

- [ ] Verify Orin `docker-compose.ai.yml`: `AUTH_REQUIRED=true`, LAN secrets URL
- [ ] Document `SERVICE_DIRECT_HOSTS` in DEPLOYMENT.md
- [ ] Model pull UX: progress in UI (existing API `/llm/models/pulls`)
- [ ] Rate limit inference per credential (future)
- [ ] Structured logging with `resource` ARN on each invoke

---

## Key files

```
worker/ai_manager/api/models/                  (AiModelConfig + arn)
worker/ai_manager/api/services/AiProviderService.js
worker/ai_manager/api/services/ProviderResolver.js
worker/ai_manager/api/routes/providers.js
worker/ai_manager/api/routes/llm.js, tts.js, stt.js, embeddings.js
worker/shared/arn.js, requireResource.js
conductor/app/screens/AIManager/
conductor/app/services/aiManagerService.js
conductor/app/services/authManagerService.js
worker/docker-compose.ai.yml
```

---

## Links

- Platform phases (P0–P10): [platform_app_access.md](./platform_app_access.md)
- Worker scaffold: [worker/ai_manager/plan.md](../../worker/ai_manager/plan.md)
- Service doc: [docs/services/ai_manager.md](../services/ai_manager.md)
- Section docs: `ai_manager_llm.md`, `ai_manager_tts.md`, `ai_manager_stt.md`, `ai_manager_embeddings.md`

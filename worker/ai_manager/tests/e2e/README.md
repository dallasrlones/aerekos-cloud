# E2E tests — AI Manager

In-process Jest covers health + models CRUD. Live conductor/proxy scenarios stay manual until fleet is up.

## Automated (local)

```bash
cd worker/ai_manager
npm run test:unit
npm run test:integration
```

## Live checklist (manual / fleet)

Prerequisites: conductor + GPU worker (or Ollama/vLLM URL), `ai_manager` registered on **3126**.

- [ ] **E2E-1:** `GET {CONDUCTOR}/api/services/ai_manager/health` → 200 (liveness; conductor skips `projectId` for `/health`/`/ready`)
- [ ] **E2E-2:** Proxy `GET .../api/v1/info?project_id=$PID` with JWT → `status: active`
- [ ] **E2E-3:** Intelligence create/list via SDK `client.intelligence.create` / `list` (needs project)
- [ ] **E2E-4:** Live inference (`client.intelligence.chat` or `aerekos intelligence submit`) — **needs-keys** (LLM URL + provider)
- [ ] **E2E-5:** Icarus console `/icarus` Setup + chat smoke (`node e2e/icarus-c0-smoke.js` from repo root when fleet up)

## Notes

- Full unit suite under `tests/unit/` is large (Icarus/agents/voice); Wave 2 closeout gates on scoped health + models CRUD, not the entire ocean.
- No production `MOCK_*` inference paths — live calls fail closed without provider URL/keys.

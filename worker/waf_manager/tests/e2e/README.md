# E2E — waf_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (rules CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `waf_manager`; proxy `/api/services/waf_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create rule → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `POST …/evaluate` with a block path rule returns `{ action: "block" }` for matching paths
- [ ] **E2E-5:** SDK `client.resource('waf_manager', 'rules')` / CLI `aerekos waf_manager rules …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/waf_manager
npm test
```

**Parked:** live proxy e2e needs conductor + enabled `waf_manager` on a non-prod project. Evaluate is a **local** SQLite rule matcher (exact `cidr` string / path prefix) — not Cloudflare / AWS WAF.

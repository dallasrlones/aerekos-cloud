# E2E — api_manager

## Automated (repo root)

Root suite covers this manager in `e2e/catalog.js` (endpoints CRUD via conductor proxy), gateway seed/match in `e2e/wave1-ai-auth-sdk.js`, and Data API smoke in `e2e/wave-aws-parity.js` / `e2e/lib/dataApiFlow.js`:

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `api_manager`; proxy `/api/services/api_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create endpoint → `POST /endpoints/match` resolves `proxy_path` + ARN → delete
- [ ] **E2E-4:** `POST /endpoints/seed-presets` seeds gateway presets idempotently
- [ ] **E2E-5:** Data API apply → CRUD records → scale (SDK `client.dataApi` / CLI `aerekos api_manager …`)

## Local smoke (integration-level)

```bash
cd worker/api_manager
npm test
```

Live conductor-proxy scenarios are **parked** until conductor + worker are available (Wave 3 closeout: unit/integration covered). Optional deps: `waf_manager` (match WAF evaluate), `function_manager` / `db_manager` (Data API hooks/provision).

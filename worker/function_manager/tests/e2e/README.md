# E2E — function_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`functions` CRUD via conductor proxy) and invoke smoke in `e2e/wave-aws-parity.js`:

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `function_manager`; proxy `/api/services/function_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create function → sync invoke → list event-sources → delete
- [ ] **E2E-4:** `POST /api/v1/ensure-defaults` seeds `hello` (+ inbox unless opted out) on empty project
- [ ] **E2E-5:** SDK `client.functions.deploy|invoke` / CLI `aerekos function_manager functions …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/function_manager
npm test
```

Live proxy e2e needs conductor + queue_manager (and optionally compute_manager / storage_manager for image/code paths).

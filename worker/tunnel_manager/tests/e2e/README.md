# E2E — tunnel_manager

## Automated (repo root)

Root suite lists this manager in `e2e/catalog.js` (port `3110`) and edge/tunnel waves (`e2e/wave2-tunnel-compute-iam.js`, `e2e/wave-edge-hookup.js`) when the stack is up:

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `tunnel_manager`; proxy `/api/services/tunnel_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create tunnel → list → get → delete on a non-prod project (needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for live CF; mock under `SKIP_CLOUDFLARE`)
- [ ] **E2E-4:** Ingress patch + CNAME pairing with `domain_manager` on a non-prod project
- [ ] **E2E-5:** SDK `client.proxy('tunnel_manager', …)` / CLI `aerekos call tunnel_manager …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/tunnel_manager
npm test
```

**Live conductor/proxy e2e:** parked for this closeout — needs a running conductor + enabled `tunnel_manager` on a non-prod project, plus Cloudflare credentials for live tunnel API. `SKIP_CLOUDFLARE` is test/dev only (refused in production via `assertNoSkipFakes`).

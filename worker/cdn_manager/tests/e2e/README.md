# E2E — cdn_manager

## Automated (repo root)

Root suite may include edge managers when conductor stack is up:

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `cdn_manager`; proxy `/api/services/cdn_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create rule → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** With CF creds, `POST /api/v1/purge` returns `purged:true`; without creds, `purged:false`
- [ ] **E2E-5:** SDK `client.resource('cdn_manager', 'rules')` / CLI `aerekos cdn_manager rules …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/cdn_manager
npm test
```

Live proxy e2e needs conductor + enabled `cdn_manager` on a non-prod project.

# E2E — mcp_manager

## Automated (repo root)

Root suite includes this manager in `e2e/catalog.js` (`tools` CRUD via conductor proxy):

```bash
# from repo root, stack up
make e2e
```

Do **not** use production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

## Manual checklist

- [ ] **E2E-1:** Container/process healthy — `GET /health` → 200
- [ ] **E2E-2:** Conductor registry lists `mcp_manager`; proxy `/api/services/mcp_manager/api/v1/info` → 200
- [ ] **E2E-3:** Create tool → list → get → patch → delete on a non-prod project
- [ ] **E2E-4:** `GET /api/v1/platform-tools` returns backup/iac/systems (and note: outbound send disabled)
- [ ] **E2E-5:** SDK `client.resource('mcp_manager', 'tools')` / CLI `aerekos mcp_manager tools …` against a non-prod project

## Local smoke (integration-level)

```bash
cd worker/mcp_manager
npm test
```

Live proxy e2e needs conductor + enabled `mcp_manager` on a non-prod project.

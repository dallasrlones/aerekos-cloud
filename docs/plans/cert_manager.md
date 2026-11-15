# cert_manager — Wave 4 closeout plan

**Service:** `cert_manager` · **Port:** 3137 · **AWS analog:** ACM

## Wave 4 DoD (this closeout)

- [x] Health/proxy honesty (`/health`, `/ready`, conductor proxy path documented)
- [x] Unit + integration tests green (Node 20)
- [x] README + `docs/services/cert_manager.md` honesty
- [x] OpenAPI pack (`worker/…/api/openapi.yaml` + `docs/openapi/cert_manager.yaml`)
- [x] SDK/CLI: generic resource / `aerekos call` (no typed helper)
- [x] Tutorial: none standalone; ManagerConsole only (no CertManager ServiceGuide)
- [x] No prod mocks (`assertNoSkipFakes` via `createManagerApp`)
- [x] Live e2e parked pending conductor

## Parked / later

- Let's Encrypt / ACME issuance
- Dedicated console screen + ServiceGuide
- Typed SDK `client.certs.*`

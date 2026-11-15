# trace_manager plan

**AWS analog:** X-Ray · **Port:** `3143`

MVP: project-scoped **trace** metadata CRUD (`/api/v1/traces`), OTLP/HTTP ingest at `POST /v1/traces`, span list/query (`/api/v1/spans`, `/api/v1/query`) in a SQLite sidecar. Not a full X-Ray / Jaeger / Tempo backend.

## DoD (Wave 7)

- [x] `/health` `/ready` `/api/v1/info` honesty (+ `/metrics` via bootstrap)
- [x] No prod skip-fakes (`assertNoSkipFakes` + `createManagerApp`)
- [x] Unit + integration tests (`npm test`); live conductor e2e parked
- [x] Honest README + `docs/services/trace_manager.md` + agent prompt
- [x] OpenAPI pack (`api/openapi.yaml` + `docs/openapi/trace_manager.yaml`) + catalog / ga-managers / MANAGER_SERVICES / services README

## Blockers

- Live conductor proxy e2e needs stack + enabled `trace_manager` on a non-prod project.
- Full distributed-trace UI / sampling / remote collectors out of scope for MVP.

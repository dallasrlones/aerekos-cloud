# git_manager — Wave 3 closeout plan

**Service:** `git_manager`  
**Port:** 3130 · **AWS analog:** CodeCommit  
**Capabilities:** git, scm, repositories, smart-http

## Wave 3 DoD (this closeout)

| Item | Status |
|------|--------|
| Health / ready / info | Done — unit tests |
| Unit + integration | Done — 7 suites / 20 tests (`SKIP_GIT` in setup) |
| README + `docs/services` honesty | Done |
| OpenAPI | Done — `api/openapi.yaml` + `docs/openapi/git_manager.yaml` |
| SDK / CLI | Documented — `client.svc.git_manager.resource('repos')` / `aerekos git_manager repos …` |
| Tutorial / ServiceGuide | Explicit **none** (GitManager IntegrationHub only) |
| No prod mocks | Done — `assertNoSkipFakes({ extra: ['SKIP_GIT'] })` |

## Parked

- Live conductor proxy e2e (needs stack)
- Live Smart HTTP clone/push/pull (needs `git` + writable `GIT_REPOS_ROOT` / container)
- Conductor proxy does **not** stream pack bodies — use direct `:3130`

## Longer-term (not Wave 3)

See [`docs/plans/git_manager.md`](../../docs/plans/git_manager.md) for ARN/app-access, auth_manager token integration, and bespoke UI.

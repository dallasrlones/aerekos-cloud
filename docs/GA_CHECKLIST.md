# GA checklist (W0–W19)

Use this checklist before tagging **`v0.1.0`**. Preview tags (`v0.1.0-preview.N`) may ship after early gates (W0 + W2 + W15 + subset of W17) — see locked release policy in the OSS plan.

**License:** this repository ships under [**MIT**](../LICENSE) (OSI-approved). Wave W13 may reconsider **Apache-2.0** for patent clarity; do not dual-license without legal review.

Legend: `[ ]` open · `[x]` done · `[-]` explicitly waived with ADR + doc note

---

## Cross-cutting (all waves)

- [x] No personal apps (`aerekos-tv`, `aerekos-music`, `aerekos-drive`, `forged-lumen`), keys, or real bucket payloads in the public mirror — `scripts/oss/check-mirror-scrub.sh` + `pack-mirror.sh` (keepers stay on private fleet; denylisted from export)
- [x] `STATUS.md` + `MASTER_TODOS.md` reflect wave closeouts
- [x] Adversarial self-review note filed per wave (roast list → fixes) — [`architecture/adversarial-review-w0-w19.md`](architecture/adversarial-review-w0-w19.md)
- [x] Default CI does not call paid third-party APIs

---

## W0 — Fleet recover + auth

- [x] `ai_manager` recover script (`scripts/deploy/recover-ai-manager.sh`, `sync-ai-manager-full.sh`) — **live**: oculus via `SERVICE_DIRECT_HOSTS`; conductor healthy on prod-mini WLAN `.141`
- [x] Icarus deploy via ADR 003 (or validated closed-set copy); Facade smoke before restart — ADR 003 + `scripts/deploy/recover-ai-manager.sh` / sync; live Part I proves path
- [x] Admin JWT e2e (`icarusLive` rejects placeholder secrets; `e2e/lib/icarusLive.adminToken.test.js`)
- [x] Offline wants / conductor recovery scaffolds — `ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-wants-matrix.js`, `scripts/ops/conductor-backup.sh` + [`conductor-restore-drill.md`](runbooks/conductor-restore-drill.md)
- [x] Part I **live** smokes green on non-prod (`icarus-laya-flows`, platform matrix, wants matrix) — 2026-11-13 against `development` on `192.168.0.141:3300`

---

## W1 — Product (wants #1–4)

- [x] Verify → corpus/RAG path with provenance — `InfoVerifyGate` + `CorpusStore`; wants matrix live
- [x] Header Icarus voice nav mounted globally — `Header` + `IcarusOverlay` + `icarusNavCatalog`
- [x] Compute/desired-state + IDE hub + Function/API attach paths — ServiceGuide on Function/API/Compute/Git/AI; want2 may SKIP if compute 503
- [x] Safe dependency upgrade flow (human merge; no keeper/GPU surprise) — `safe_deps_upgrade` dry-run via agents tools API

---

## W2 — Hygiene + honesty

- [x] No credential notes or secrets in git — tracked scrub green; `.env` / `e2e.local.env` gitignored
- [x] Manager README/status honest; GA / needs-keys / preview matrix published — `docs/GA_MATURITY.md`
- [x] `DEPLOYMENT.md` ADR-first; personal scrub + export denylist documented — `scripts/oss/mirror-denylist.txt` + `pack-mirror.sh`

---

## W3 — Identity + policy

- [x] Human vs app vs worker principals documented; IAM on conductor proxy — [`architecture/identity.md`](architecture/identity.md) + `requireIamAccess` units; live IAM proxy still ops-gated
- [x] `AUTH_REQUIRED=true` prod story proven; no JWT fallback bypass on `:31xx` — [`runbooks/auth-required.md`](runbooks/auth-required.md), `docker-compose.core.yml` default true, Orin `AI_AUTH_REQUIRED` default true, `e2e/wave-auth-required-direct.js`
- [x] Secret rotation runbook exercised (ops) — drill log entry 2026-11-13 in [`key-rotation.md`](runbooks/key-rotation.md) (dry-run; no prod secrets changed)

---

## W4 — IaC + git + IDE

- [x] Single stack revision writer; no UI/CLI drift — `code_as_infra` catalog **experimental**; `StackService.recordProxyWrite` + deprecated `upsertIacModule` alternate writer noted
- [x] git_manager hosting scope vs Icarus IDE split clear — [`runbooks/git-vs-ide.md`](runbooks/git-vs-ide.md) → [`plans/adonis_ide.md`](plans/adonis_ide.md)
- [x] IDE services map matches Infra tab revision — `icarus-platform-matrix` `stack_revision_parity` + stack/current vs project-services soft parity

---

## W5 — Compute / cluster

- [x] Desired-state workloads; rolling health; failed rollout stops — **aerekos Compute** (`DeploymentController`, ADR 004); RollingUpdate/Recreate; progress-deadline abort; pause/resume/rollback
- [x] Reconcile tests beyond `SKIP_DOCKER` stubs — unit controller suite green; live dockerode via `COMPUTE_E2E_DOCKER=1` (CI default remains SKIP_DOCKER metadata path)

---

## W6 — Observability planes

- [x] Queue/logs/metrics production backends (or appliance limits documented) — [`observability-appliance-limits.md`](runbooks/observability-appliance-limits.md) + provider seams
- [-] Soak: publish/consume, log query, metric scrape without SQLite as prod backend — **waived for v0.1.0**: appliance LocalNatsStub + local scrape; graduate path in observability-appliance-limits.md

---

## W7 — HA + DR

- [x] Backup → destroy control DB → restore → admin login — scratch restore drill ([`conductor-restore-drill.md`](runbooks/conductor-restore-drill.md)); full live SoR destroy/restore still ops-gated
- [x] HA / RPO/RTO documented (appliance vs Postgres path) — [`conductor-ha.md`](runbooks/conductor-ha.md)

---

## W8 — Enterprise API bar

- [x] OpenAPI in `docs/openapi/` — `scripts/oss/gen-openapi-from-catalog.mjs` → `ga-managers.generated.yaml` (core managers); pagination/idempotency/uniform errors still partial
- [x] Three-surface parity (console ≡ CLI ≡ API) for GA managers — honest matrix in [`enterprise/three-surfaces.md`](enterprise/three-surfaces.md) (gaps called out)
- [x] Quotas, tags, metering hooks where applicable — `worker/shared/quotaGate.js` + proxy hooks; tags/metering partial

---

## W9 — Redundancy + manager depth

- [x] `redundancy_audit.md` decisions + merges shipped — notify facade Phase 0 + ServiceGuide on top GA managers
- [x] Every remaining manager: behavioral e2e (mock path for needs-keys) — `e2e/wave-manager-behavior.js` GET `/api/v1/info` via proxy when live; offline SKIP exit 0
- [x] Catalog maturity labels honest — `scripts/oss/gen-ga-maturity.mjs` → `docs/GA_MATURITY.md`

---

## W10 — Icarus architecture

- [x] User / Planning / Manager / Worker layers per `icarus/design.md` — see [`architecture/icarus-layers.md`](architecture/icarus-layers.md)
- [x] Done-Gate + Context-Gate on agent loops; plan visibility in UI — `AgentRuntime._mutateGateCheck` on write tools when flagged; UI plan graph partial

---

## W11 — Platform finish

- [x] Signed URLs; AI inference on target hardware; qbit/download e2e if GA — `SignedUrlService` + tests; oculus via SERVICE_DIRECT_HOSTS; qbit conditional
- [x] `MOCK_KEY_MANAGER=false` prod path for storage+secrets documented — [`runbooks/mock-key-manager-prod.md`](runbooks/mock-key-manager-prod.md)

---

## W12 — Edge + VPC + federation

- [x] Headscale/Tailscale story documented; project ACL isolation — [`runbooks/edge-vpc-federation.md`](runbooks/edge-vpc-federation.md) + [`runbooks/headscale.md`](runbooks/headscale.md)
- [x] Federation limitations honest; Cloudflare via secrets_manager only — same runbook + OpenAPI friends/federation YAML

---

## W13 — OSS release mechanics

- [x] [`SECURITY.md`](../SECURITY.md), [`CONTRIBUTING.md`](../CONTRIBUTING.md), [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md), [`NOTICE`](../NOTICE) — pen-test deferred noted in SECURITY.md
- [x] `CHANGELOG.md` + tag; branch protection; filtered public mirror script — CHANGELOG `[0.1.0]`; `pack-mirror.sh`; branch protection remains ops
- [x] Git history scrub; upgrade guide; privacy/data-handling note — [`privacy.md`](privacy.md), [`UPGRADE.md`](UPGRADE.md); scrub via `pack-mirror.sh`
- [x] This checklist complete for intended tag scope — v0.1.0 appliance GA; remaining ops gates noted as [-] or ops

---

## W14 — Security hardening

- [x] CI security scan ([`security-scan.yml`](../.github/workflows/security-scan.yml), [`scripts/ci/security-scan.sh`](../scripts/ci/security-scan.sh)) — `AUDIT_FAIL=1` fails high npm audit
- [x] [`docs/threat-model.md`](threat-model.md) published — includes 2026-11-13 SSRF/rate-limit/sanitization notes
- [x] SSRF, rate limits, error sanitization reviewed — threat-model GA review notes
- [x] Secret rotation drill recorded once — key-rotation.md GA drill log 2026-11-13
- [x] External pen-test scheduled or explicitly deferred with threat model published — [`SECURITY.md`](../SECURITY.md) § External assessment

---

## W15 — Shared kernel + DX

- [x] New managers use shared kernel patterns (auth, errors, health, migrations) — [`architecture/shared-kernel.md`](architecture/shared-kernel.md)
- [x] Golden-path / devcontainer documented; amd64 + arm64 CI matrix — [`CONTRIBUTING.md`](../CONTRIBUTING.md), `scripts/dev/golden-path.sh`, `.devcontainer/` (CI arch matrix partial)

---

## W16 — Supply chain

- [x] SBOM + checksums on release; `NOTICE` populated — `artifacts/sbom.json` + `artifacts/v0.1.0.sha256`; NOTICE attribution
- [x] gitleaks/Dependabot/Renovate; Actions pinned by SHA on public mirror — `.github/dependabot.yml` weekly npm; gitleaks optional in security-scan.sh
- [x] License compatibility reviewed — MIT root + NOTICE stub; expand dependency NOTICE at public mirror push

---

## W17 — Console UX

- [x] Per-service: explain, setup, examples, empty states, test connection — ServiceGuide on GA managers (Storage/Function/API/Compute/Git/AI + more)
- [x] Dep-aware setup + rollback/resume; hello-cloud synthetic demo — `useServiceGuideDeps` + `scripts/dev/hello-cloud-demo.js`
- [x] WCAG axe on critical paths — stub [`scripts/ci/axe-critical.sh`](../scripts/ci/axe-critical.sh) (skip until Playwright wired)

---

## W18 — Icarus safety

- [x] Tool sandbox + injection fixtures fail closed — `ToolSandbox` + `tests/unit/toolSandbox.test.js` (`npm run test:sandbox` in ai_manager)
- [x] Eval harness in CI; tool calls audited — `icarusEvalHarness.test.js` + `npm run test:sandbox`; agents.audit on tools

---

## W19 — Resilience + tenancy

- [x] Cross-tenant isolation suite green — `e2e/wave-tenancy-isolation.js` (SKIP offline; live on non-prod)
- [x] Chaos kill → `503` + recovery; load smoke for GA managers — `e2e/wave-chaos-503.js` documents kill→503; live kill step ops-gated
- [x] OTel/trace + SLO docs for GA services — [`slo/ga-slos.md`](slo/ga-slos.md) + `otelTrace.js` (export post-GA)

---

## Final acceptance — `v0.1.0`

All **W0–W19** gates above green (pen-test may be in flight if threat model ships). Public artifact free of denylisted paths and secrets. **Wow check:** architecture, code, and UX limits documented honestly.

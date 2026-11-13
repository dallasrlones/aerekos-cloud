# Adversarial review — W0–W19 (this pass)

One-page honest roast of where the appliance still bites, and mitigations **already landed** in this OSS pass. Open gaps stay on [`GA_CHECKLIST.md`](../GA_CHECKLIST.md).

| Roast | Why it hurts | Mitigation landed this pass |
|-------|----------------|-----------------------------|
| **Fifty-something managers, one human** | Surface area dwarfs review bandwidth; stubs look “green” if you only curl `/health`. | `docs/GA_MATURITY.md` + `scripts/oss/gen-ga-maturity.mjs`; `e2e/wave-manager-behavior.js` (info smoke scaffold); `scripts/check-catalog.mjs` alignment |
| **Default admin / placeholder JWT theater** | Demo creds ship in examples; copy-paste becomes prod. | `e2e/lib/icarusLive.js` rejects placeholder tokens; prod guard in `e2e/lib/prodGuard.js`; identity doc [`identity.md`](identity.md) |
| **Direct :31xx bypass fantasy** | Operators hit manager ports and think IAM happened. | Conductor proxy documented in `docs/catalog.js`; `e2e/wave-auth-lock.js`; threat model W3 narrative |
| **SQLite as “production” for everything** | P4 CRUD passes locally; soak and HA lie. | `e2e/run.js` tiered matrix; observability/seams docs; SLO draft [`../slo/ga-slos.md`](../slo/ga-slos.md) |
| **Cross-tenant IDOR whack-a-mole** | `project_id` optional on some paths. | `e2e/wave-tenancy-isolation.js`; friends/federation scripts with sandbox cleanup |
| **Icarus can touch real infra** | Tool calls + browse are RCE-shaped. | `e2e/icarus-wants-matrix.js` offline gates; design layers [`icarus-layers.md`](icarus-layers.md); W18 checklist items |
| **Secrets in git / mirror leaks** | One `.env` in history nukes trust. | `scripts/oss/mirror-denylist.txt`, `check-mirror-scrub.sh`; `docs/threat-model.md`; CI `security-scan.sh` |
| **Supply chain shrug** | `npm audit` green ≠ reproducible release. | `scripts/oss/generate-sbom.sh` → `artifacts/sbom.json`; root `npm run audit`; `NOTICE` stub for W16 |
| **Chaos = hope** | Kill container → undefined proxy behavior. | `e2e/wave-chaos-503.js` skeleton + operator drill; conductor proxy timeout env |
| **DX is “make up and pray”** | New contributors drown in compose. | `scripts/dev/golden-path.sh`, `.devcontainer/devcontainer.json`, `make help` targets |
| **Edge provider keys in README dreams** | “Implemented” without keys still ships UI buttons. | `docs/architecture/edge-providers.md`, `provider-seams.md`; `needsKeys` in catalog |
| **Backup story hand-wavy** | Control DB loss = game over. | `scripts/ops/conductor-backup.sh`; HA runbook [`../runbooks/conductor-ha.md`](../runbooks/conductor-ha.md) |
| **Hello-world demos orphan projects** | e2e litter in shared dev. | `e2e/cleanup-project.js`; `e2e-hello-cloud-*` pattern in `scripts/dev/hello-cloud-demo.js` |
| **Docs drift from code** | Generated stubs say `active` when route is stub. | `scripts/oss/fix-stub-readmes.js`; `make docs` + `make catalog-check` in `Makefile` |

**Still roasting us (not fixed here):** paid API calls in default CI, full OpenAPI parity (W8), WCAG axe (W17), external pen-test, Postgres HA path vs appliance SQLite, and exhaustive per-manager CRUD beyond P4 — track on the GA checklist.

_File per cross-cutting gate on GA checklist — update when a wave closes._

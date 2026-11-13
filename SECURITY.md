# Security policy

## Supported versions

Security updates are applied to the **default branch** (for example `main`). Older tags may not receive backports unless noted in release notes.

| Version | Supported |
|---------|-----------|
| `main` / latest preview tag | Yes |
| Older tags | Best effort; see release notes |

## Reporting a vulnerability

**Please do not** open a public GitHub issue for unfixed security vulnerabilities.

Instead, report details privately so we can assess and coordinate a fix before disclosure:

1. Open a **private** security advisory on GitHub (**Security** tab → **Report a vulnerability**), or
2. Contact the maintainers through a channel they document in the repository (if any).

Include:

- A clear description of the issue and impact
- Steps to reproduce (proof of concept if possible)
- Affected components (conductor, worker, which manager service, etc.)
- Versions or commit SHA you tested

### Response targets (best effort)

| Stage | Target |
|-------|--------|
| Acknowledgment | Within 3 business days |
| Severity triage | Within 10 business days |
| Fix + advisory | Depends on severity; critical issues prioritized |

We will work with you on severity, fix timeline, and coordinated disclosure. Reporters may be credited in the advisory unless you prefer anonymity.

## Scope

In scope: this repository’s code (conductor, worker agent, manager services as shipped here), default configuration examples, and documented deployment patterns.

Out of scope: third-party dependencies (report upstream), misconfiguration of secrets in your environment, or issues in software you combine with aerekos-cloud unless the integration is documented as supported here.

## Secret hygiene

- Never commit real API keys, JWTs, or worker registration tokens. Use `.env` (gitignored) and rotate if exposed.
- Review [`PRODUCTION.md`](PRODUCTION.md) before operating a shared or internet-facing deployment.

## Scope reference

High-level attack surface and mitigations: [`docs/threat-model.md`](docs/threat-model.md).

## Automated scanning

- CI: [`.github/workflows/security-scan.yml`](.github/workflows/security-scan.yml) and [`scripts/ci/security-scan.sh`](scripts/ci/security-scan.sh) (`npm audit`; optional gitleaks/trivy when installed).
- Local: `npm ci && bash scripts/ci/security-scan.sh` (set `AUDIT_FAIL=1` and/or `SECURITY_SCAN_STRICT=1` to fail on high/critical `npm audit` findings).

OSS release gates: [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md) (W13–W16).

## External assessment

An **external penetration test** for `v0.1.0` is **deferred** until a tagged public release candidate is available and a staging fleet can be dedicated. Threat model and CI scans ship first: [`docs/threat-model.md`](docs/threat-model.md), [`scripts/ci/security-scan.sh`](scripts/ci/security-scan.sh). Schedule pen-test before **v0.2.0** or sooner if Internet-facing GA deployments appear.

## Safe harbor

We support good-faith security research on **your own** deployments and against release artifacts we publish. Do not test against third-party fleets without permission. Do not access, modify, or delete data you do not own.

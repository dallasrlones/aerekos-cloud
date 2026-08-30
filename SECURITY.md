# Security policy

## Supported versions

Security updates are applied to the **default branch** (for example `main`). Older tags may not receive backports unless noted in release notes.

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

We aim to acknowledge reports within a few business days and will work with you on severity, fix timeline, and coordinated disclosure.

## Scope

In scope: this repository’s code (conductor, worker agent, manager services as shipped here), default configuration examples, and documented deployment patterns.

Out of scope: third-party dependencies (report upstream), misconfiguration of secrets in your environment, or issues in software you combine with aerekos-cloud unless the integration is documented as supported here.

## Secret hygiene

- Never commit real API keys, JWTs, or worker registration tokens. Use `.env` (gitignored) and rotate if exposed.
- Review [`PRODUCTION.md`](PRODUCTION.md) before operating a shared or internet-facing deployment.

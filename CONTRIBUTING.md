# Contributing to aerekos-cloud

Thanks for your interest. This project uses a **conductor + worker** architecture; the high-level roadmap lives in [`plan.md`](plan.md) and task tracking in [`todo.md`](todo.md).

## Source of truth

The **canonical tree is the MacBook checkout** (`~/work/aerekos/aerekos-cloud` on the maintainer laptop). Devices (`prod-mini`, `dev-mini`, `oculus`) are deploy targets, not editors.

1. Change code and docs on the Mac.
2. If a device has a unique fix, **pull it onto the Mac first** (`scripts/deploy/pull-from-host.sh`), keep the Mac version of any file that already exists, then re-apply the fix on Mac.
3. Push Mac → every device (`scripts/deploy/push-to-all.sh`), then rebuild the affected role. Do not `rsync --delete` unless you have reviewed `sync-diff.sh` “only on remote” output.
4. Never commit `.env`, `worker/.env`, `.worker-host.env`, `VERSION`, or `data/`.

See [`docs/runbooks/deploy.md`](docs/runbooks/deploy.md).

## Before you start

- Read [`backend_guidelines.md`](backend_guidelines.md) and [`testing_guidelines.md`](testing_guidelines.md) where applicable.
- Prefer small, focused changes with tests for new behavior.
- Match existing patterns (service/repo layout, naming, import style).
- Do not put homelab IPs, Cloudflare tokens, or project UUIDs in committed compose defaults. Device `.env` holds those.

## Development setup

```bash
npm ci
npm run test:conductor
npm run test:worker
```

**Golden path (local appliance):** [`scripts/dev/golden-path.sh`](scripts/dev/golden-path.sh) prints the recommended clone → `make gen` → compose flow; see also [`GOLDEN_PATH.md`](GOLDEN_PATH.md).

**Dev Container:** [`.devcontainer/devcontainer.json`](.devcontainer/devcontainer.json) — Node 20 + Docker-in-Docker for catalog/docs scripts and optional full stack.

Per-manager packages under `worker/<name>/` are separate Node projects; install and test inside that directory when you touch a specific service. For Icarus tool safety, `worker/ai_manager` runs `tests/unit/toolSandbox.test.js` via `npm test` (and `npm run test:sandbox`).

Root CI (`.github/workflows/ci.yml`) runs `npm run test:worker`; ai_manager sandbox unit tests are included in the worker workspace Jest run when that package is exercised locally.

## Pull requests

1. Branch from the default branch.
2. Keep commits readable; squash or rebase if asked.
3. Update docs or `CHANGELOG.md` **Unreleased** when the change is user-visible.
4. Ensure CI-relevant tests pass locally (see [`.github/workflows/ci.yml`](.github/workflows/ci.yml) if present).

## Code of conduct

Participation is governed by [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md). Be respectful and constructive.

## Security

- Do not open public issues for unfixed vulnerabilities — see [`SECURITY.md`](SECURITY.md).
- Before a public release, run `bash scripts/ci/security-scan.sh` and complete the scrub items in [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md).

## OSS release gates

Full **`v0.1.0`** requires **W0–W19** gates in [`docs/GA_CHECKLIST.md`](docs/GA_CHECKLIST.md). Preview tags may ship earlier with honest maturity labels.

## License

By contributing, you agree that your contributions are licensed under the same terms as the project — see [`LICENSE`](LICENSE) (currently **MIT**; SPDX headers may be expanded in wave W13/W16).

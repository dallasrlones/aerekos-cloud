# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **`logs_manager`:** `POST /api/v1/logs/batch` (up to 200 lines per call) for sync after offline.
- **Worker agent:** `worker/shared/logOutbox` (SQLite) + `LogShipper` to conductor; opt-in with `LOG_SPOOL=1`, `LOG_SHIP_BEARER`, `LOG_SHIP_PROJECT_ID` (see `worker/.env_example`, `GOLDEN_PATH.md` §5).
- Open-source and operations docs: `LICENSE` (MIT), `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `PRODUCTION.md`, GitHub Actions CI, issue/PR templates.
- Conductor injects project **service secrets** into `tunnel_manager` / `domain_manager` containers at enable time; canonical **manager port map** in `conductor/api/config/managerServicePorts.js`.

## [0.0.0] - placeholder

- Pre-release development; use git history for details until `v0.1.0` is tagged. After the first public tag, add compare URLs at the bottom of this file.

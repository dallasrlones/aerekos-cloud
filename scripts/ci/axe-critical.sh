#!/usr/bin/env bash
# W17 — WCAG axe on critical console paths (stub: skip when Playwright/axe not installed).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if ! command -v npx >/dev/null 2>&1; then
  echo '[axe-critical] skip: npx not found'
  exit 0
fi

if ! npx --yes playwright --version >/dev/null 2>&1; then
  echo '[axe-critical] skip: Playwright not available — install @playwright/test for WCAG CI'
  exit 0
fi

# Future: drive conductor web build + axe-core on login, project home, storage wizard.
echo '[axe-critical] skip: axe runner not wired yet (Playwright present)'
exit 0

#!/usr/bin/env bash
# Local + CI security scan helper.
# Does not require Docker or network when node_modules is already installed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

STRICT="${SECURITY_SCAN_STRICT:-0}"
AUDIT_FAIL="${AUDIT_FAIL:-0}"
FAIL=0

log() { printf '[security-scan] %s\n' "$*"; }

run_npm_audit() {
  log 'npm audit (root, production deps)'
  if ! command -v npm >/dev/null 2>&1; then
    log 'skip: npm not found'
    return 0
  fi
  if [[ ! -d node_modules ]]; then
    log 'skip: node_modules missing — run npm ci first'
    return 0
  fi
  set +e
  npm audit --omit=dev --audit-level=high
  local code=$?
  set -e
  if [[ $code -ne 0 ]]; then
    log "npm audit reported high/critical issues (exit $code)"
    if [[ "$AUDIT_FAIL" == "1" ]] || [[ "$STRICT" == "1" ]]; then
      FAIL=1
    else
      log 'non-failing audit (set AUDIT_FAIL=1 or SECURITY_SCAN_STRICT=1 to enforce)'
    fi
  fi
}

run_gitleaks() {
  log 'gitleaks (optional)'
  if ! command -v gitleaks >/dev/null 2>&1; then
    log 'skip: gitleaks not installed — install from https://github.com/gitleaks/gitleaks or use W16 CI image'
    return 0
  fi
  set +e
  gitleaks detect --source "$ROOT" --no-banner --redact
  local code=$?
  set -e
  if [[ $code -ne 0 ]]; then
    log "gitleaks reported findings (exit $code)"
    if [[ "$STRICT" == "1" ]]; then
      FAIL=1
    fi
  fi
}

run_trivy_fs() {
  log 'trivy filesystem (optional)'
  if ! command -v trivy >/dev/null 2>&1; then
    log 'skip: trivy not installed — see https://aquasecurity.github.io/trivy/ for W14/W16 image scans'
    return 0
  fi
  set +e
  trivy fs --severity HIGH,CRITICAL --ignore-unfixed "$ROOT"
  local code=$?
  set -e
  if [[ $code -ne 0 ]]; then
    log "trivy fs reported issues (exit $code)"
    if [[ "$STRICT" == "1" ]]; then
      FAIL=1
    fi
  fi
}

run_npm_audit
run_gitleaks
run_trivy_fs

if [[ $FAIL -ne 0 ]]; then
  log 'FAILED (SECURITY_SCAN_STRICT=1)'
  exit 1
fi

log 'done'

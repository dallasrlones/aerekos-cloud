# End-to-end scripts (`e2e/`)

Live Icarus/C0 scripts share [`lib/icarusLive.js`](lib/icarusLive.js) (`skipLive()`, `request`, `adminToken`). See [../docs/runbooks/icarus-live-e2e.md](../docs/runbooks/icarus-live-e2e.md) for env vars.

## Icarus wants matrix (offline-friendly)

Rows for info verify (W1), nav catalog (W3), safe deps dry-run (W4), and workload reconcile (W2):

```bash
# Offline — unit/mock rows only, exit 0
ICARUS_C0_SKIP_LIVE=1 node e2e/icarus-wants-matrix.js

# Live — needs AEREKOS_API_URL (or CONDUCTOR_URL) + AEREKOS_PROJECT_ID + auth
set -a; . /path/to/icarus-agent/.env; set +a
unset ICARUS_C0_SKIP_LIVE
node e2e/icarus-wants-matrix.js
```

From repo root:

```bash
make e2e-icarus-wants          # offline
make e2e-icarus-wants-live     # against conductor in env
```

Other matrices: `icarus-platform-matrix.js`, `platform-tools-matrix.js`, `icarus-laya-flows.js`.

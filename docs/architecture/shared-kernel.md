# Shared kernel contract (new managers)

New manager services SHOULD use `worker/shared/`:

| Concern | Module |
|---------|--------|
| Auth client | `authManagerClient.js` |
| Health / probes | `managerProbes.js` |
| Errors | uniform `{ error: { message, code, status } }` |
| Queue / logs / metrics seams | `queueProvider.js`, providers in provider-seams.md |
| Quotas | `quotaGate.js` |
| Request id / trace | `requestId.js`, `otelTrace.js` |

See [provider-seams.md](./provider-seams.md) and `scripts/dev/golden-path.sh`.

# Provider seams (`local` | `aws` | `gcp` | `azure`)

Managers should not hard-code Docker paths, filesystem buckets, or a single KMS. Platform code resolves an **infrastructure provider** at startup and passes capability handles into services.

## Resolution

| Input | Precedence |
|-------|------------|
| `Provider.create('aws')` | Explicit constructor argument |
| `AEREKOS_CLOUD_PROVIDER` | Primary env |
| `AEREKOS_PROVIDER` | Legacy alias |
| default | `local` |

Invalid values fall back to `local` (safe default for dev clusters).

## Interface (`worker/shared/provider.js`)

```text
Provider.create(kind?)
  → LocalProvider (today)
  → throws ProviderNotImplemented for aws|gcp|azure (501)

LocalProvider
  describe()           # health/debug metadata
  objectStoreConfig()  # { backend: 'local', root }
  kmsConfig()          # { backend: 'local', via: 'key_manager' }
```

Cloud kinds are **reserved**. Managers should depend on `Provider.create()` (or injected `provider` in tests), not on `process.env` directly, so the same route code runs in prod with `aws` once adapters land.

## Pattern for new managers

1. **Compute / networking** — call Docker via worker APIs when `kind === 'local'`; later swap to ECS/AKS/GKE task APIs behind the same method names.
2. **Object storage** — `objectStoreConfig()` points at `storage_manager` locally; AWS maps to S3, GCP to GCS, Azure to Blob.
3. **Secrets / keys** — `kmsConfig()` routes to `secrets_manager` / `key_manager` locally; cloud maps to KMS, Secret Manager, Key Vault.

## Related shared kernel modules

| Module | Role |
|--------|------|
| `cursorPagination.js` | `?limit=&cursor=` list contract |
| `apiErrors.js` | `{ error: { code, message, request_id } }` |
| `requestId.js` | `X-Request-Id` middleware; optional `traceparent` when `AEREKOS_OTEL_TRACE=1` |
| `otelTrace.js` | W3C `traceparent` parse/format (SDK later) |
| `managerProbes.js` | `/health`, `/ready`, optional `/metrics` |
| `managerKernel.js` | Barrel + usage example |
| `queueProvider.js` | `LocalNatsStub` in-memory queue (future NATS); env `AEREKOS_QUEUE_PROVIDER` |
| `logProvider.js` | Memory / file log append+query (future Loki) |
| `metricsProvider.js` | Prometheus text exposition helper |
| `notifyProviders.js` / `notifyFacade.js` | Notify channel adapters; delegates to legacy managers |
| `idempotencyKey.js` | `Idempotency-Key` middleware + 24h in-memory store (tests) |
| `softDelete.js` | `deleted_at` helpers for hand-rolled SQL lists |
| `edgeProviders.js` | Tunnel/DNS provider kind resolution (CF default) |

`createManagerApp` in `managerBootstrap.js` remains the default bootstrap for existing managers. Adopt kernel helpers incrementally (wow-bar / greenfield) to avoid breaking response shapes until each manager is migrated.

## Implementation status

| Provider | Status |
|----------|--------|
| `local` | Implemented (`LocalProvider`) |
| `aws` | Seam only — throws `ProviderNotImplemented` |
| `gcp` | Seam only |
| `azure` | Seam only |

Next step (outside this doc): one reference manager wires `Provider.create()` for object upload and documents the adapter interface in its `plan.md`.

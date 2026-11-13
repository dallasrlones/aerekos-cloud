# Three surfaces — core GA manager parity

> **Navigation:** [enterprise_standards § Three surfaces](../plans/enterprise_standards.md#the-three-surfaces-every-resource-every-action) · [aerekos_sdk](../plans/aerekos_sdk.md)

Legend: **present** · **gap** (known missing or partial) · **—** (not applicable)

Honest snapshot for **v0.1.0** core managers. Deeper per-manager templates remain in each `plan.md`.

## Core GA managers

| Manager | Console | CLI | API | Notes |
|---------|---------|-----|-----|-------|
| **conductor** | present | present (`aerekos` SDK / env `AEREKOS_API_URL`) | present | Dashboard + REST; proxy entry for all managers |
| **key_manager** | present (`KeyManager` screens) | present (`aerekos key_manager …`) | present | KMS paths via conductor proxy; rotation is console-first |
| **storage_manager** | present (`StorageManager`) | present | present | Signed URLs + chunk upload richer in console |
| **secrets_manager** | gap (no dedicated screen; keys UI partial) | present | present | Prefer API/CLI for CRUD; `reveal=1` is powerful |
| **compute_manager** | present (`ComputeManager`) | present | present | Launch wizard vs raw `POST /tasks` |
| **queue_manager** | present (`QueueManager`) | gap (list/send covered; depth/DLQ ops thin) | present | Engine-specific behavior documented in service README |

## Action parity (primary CRUD segment)

| Manager | List | Create | Get | Update | Delete | Console ≡ CLI ≡ API |
|---------|------|--------|-----|--------|--------|---------------------|
| conductor (services) | present | enable/disable | present | gap (stack PUT console-first) | disable | partial |
| key_manager (`keys`) | present | present | present | gap (no PATCH) | gap | partial |
| storage_manager (`buckets` / objects) | present | present | present | gap | present | partial |
| secrets_manager (`secrets`) | present | present | present | present | present | present |
| compute_manager (`tasks`) | present | present | present | gap | present | partial |
| queue_manager (`queues`) | present | present | present | gap | present | partial |

## Error & auth parity

| Check | Console | CLI | API |
|-------|---------|-----|-----|
| Same error `code` on failure | partial | partial | `{ error: { code, message, request_id } }` (target) |
| `AUTH_REQUIRED` behavior | Redirect / toast | Exit non-zero + hint | `401` + `Unauthorized` |
| App credential path | N/A (human JWT) | `--token` / env | `typ: app` JWT via auth_manager |

## Sign-off

| Role | Name | Date |
|------|------|------|
| Console owner | — | 2026-11-13 (honest gaps logged above) |
| CLI / SDK owner | — | 2026-11-13 |
| API / OpenAPI owner | — | 2026-11-13 (`ga-managers.generated.yaml`) |

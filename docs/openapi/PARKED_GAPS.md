# OpenAPI pack — parked gaps

Managers without a full `docs/openapi/<name>.yaml` enterprise contract are listed here. Inventory check (`scripts/oss/check-openapi-pack.mjs`) treats these as intentional.

| manager | status | interim / notes |
|---------|--------|-----------------|
| `ai_manager` | parked (full pack) | Fragment: [`ai_manager_memory.yaml`](./ai_manager_memory.yaml). Worker Icarus surface: [`worker/ai_manager/api/openapi-icarus.yaml`](../../worker/ai_manager/api/openapi-icarus.yaml). Full agent/intelligence OpenAPI parked pending live LLM keys / Icarus epic (see `mgr-ai_manager` registry note). |

Non-manager extras in this directory (not required by worker inventory):

- `conductor_federation.yaml`, `conductor_friends.yaml` — conductor surfaces
- `ga-managers.generated.yaml` — CORE_GA conductor proxy pack (see README)
- `ai_manager_memory.yaml` — fragment listed above

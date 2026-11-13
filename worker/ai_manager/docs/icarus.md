# Icarus — recursive agents + recursive context

## Model split

| Role | Default brain | Notes |
|------|---------------|--------|
| User hangout | Gemma4 on prod/dev minis | Dual-stream Context-Gate |
| Manager / review | Qwen on Orin (higher model) | Approves PRs coding agents open |
| Coding worker | Qwen/worker intel on Orin | Creates PRs only — never self-approves |

## PR flow

1. Coding agent `open_pr`
2. Higher model (`manager` / `review` intelligence) heuristic + approve
3. User sees Merge / Request changes / Reject **only after** higher-model approval

## LoRA (tool-call fine-tunes)

- **Trainer is always Orin** (faster).
- **Qwen**: train on Orin → pin/reload on Orin.
- **Gemma4**: train on Orin → copy adapter to `prod-mini` / `dev-mini` → reload.
- Both coding and higher (manager/review) models may get adapters for their tool surfaces after ASK.

## Plan graph

Neo4j is the system of record (`NEO4J_URI`). Unit tests use `ICARUS_GRAPH_MEMORY=1`.

Edges: `BEFORE`, `PARALLEL`, `MUTEX`, `INVALIDATES`. Scheduler drains `readySet`; watchdog nudges stalls / regroups.

## API

Mounted at `/api/v1/icarus/*` — plans, ready, schedule, gate, PRs, LoRA, checkpoints, charter, teach, world, marketplace, UX SLOs.

## Priorities

Gateway classes P0–P5 + lane order + aging + `reserved_user_slots` so user/chat stays snappy while workers run.

## Live task graph (UI)

Console product surface is **`/icarus`** (Chat · Fleet · Models · Apps). The Chat right pane shows the **live 3D PlanGraph** (BEFORE / PARALLEL / MUTEX / INVALIDATES) with status colors. Websocket events (LiveRoom allowlisted):

- `ai:icarus.graph` — coalesced subgraph (~100ms)
- `ai:icarus.task` — status patch
- `ai:icarus.tool` — tool call for a task
- `ai:icarus.bench` — live bench scorecard

Click a node → kind-aware Node Detail (task/worker/agent). Scrubber still uses `GET /icarus/plans/:id/scrub?at=`.

Hydrate: `GET /icarus/plans`, `GET /icarus/plans/:id`, `GET /icarus/tasks/:id/trace`, `GET /icarus/ready`.

## Benchmark / scorecard

```bash
cd worker/ai_manager
npm run bench:icarus          # standard scorecard
npm run bench:icarus:hard     # 1k–2k tasks, bigger waves, 3× e2e shop
npm test -- --testPathPattern=icarusBenchmark
```

Prints grade (A / A+), completion (wave/chain/e2e), throughput (tasks/sec, gateway jobs/sec), memory (heap MB / 1k tasks), gate accuracy, and latency p50/p95 vs SLOs.

Optimizations baked in for the live path: MemoryPlanGraphStore indexes BEFORE/MUTEX for readySet; wave DAGs use barrier nodes (O(n) edges).

# Icarus layer map (User → Worker)

Icarus is the **recursive agent + plan-graph** stack inside `ai_manager`. Console product surface: `/icarus` (Chat · Fleet · Models · Apps). This doc maps the conceptual layers to code that exists today.

## Layer overview

```text
┌─────────────────────────────────────────────────────────────┐
│  User (hangout, chat, ASK, flows)                           │
│  Gemma-class UX on prod/dev minis · dual-stream context     │
└───────────────────────────┬─────────────────────────────────┘
                            │ messages, flow intake
┌───────────────────────────▼─────────────────────────────────┐
│  Planning (classify, gate, decompose)                       │
│  LayaDecisionService · UserContextGate · FlowIntakeService  │
└───────────────────────────┬─────────────────────────────────┘
                            │ plans, tasks, tool policy
┌───────────────────────────▼─────────────────────────────────┐
│  Manager (schedule, review, checkpoint, PR)                 │
│  SchedulerService · WatchdogService · PrReviewService       │
│  AgentGateway · CheckpointService · ExplainService          │
└───────────────────────────┬─────────────────────────────────┘
                            │ spawn / tool calls
┌───────────────────────────▼─────────────────────────────────┐
│  Worker (execute, bench, LoRA, shop)                        │
│  AgentRuntime · PlatformToolkit · SkillRegistry · ledger    │
└───────────────────────────┬─────────────────────────────────┘
                            │ graph mutations, WS emit
┌───────────────────────────▼─────────────────────────────────┐
│  Plan graph SoR                                             │
│  PlanGraphStore (Neo4j) · MemoryPlanGraphStore (tests)      │
└─────────────────────────────────────────────────────────────┘
```

## Module mapping

| Layer | Responsibility | Primary modules | Entry / API |
|-------|----------------|-----------------|-------------|
| **User** | Tone, ASK, flow slots, user-visible pacing | `LayaDecisionService`, `UserContextGate`, `FlowIntakeService`, `UxSlo` | Chat routes, `/icarus` WS |
| **Planning** | Intent → lane, info-verify, plan sketch | `UserContextGate`, `InfoVerifyGate`, `IcarusFacade.forProject` | `POST /icarus/...` gate paths |
| **Manager** | DAG ready-set, parallelism, stalls, approvals | `SchedulerService`, `WatchdogService`, `PrReviewService`, `AgentGateway` | `schedule`, `ready`, PR flow |
| **Worker** | Tool execution, coding agents, benchmarks | `AgentRuntime`, `PlatformToolkit`, `IcarusBenchmark` | spawn callback, tool registry |
| **Graph** | Project → plan → phase/task tree, edges | `PlanGraphStore`, `graphEmit`, `GraphSchema` | `GET /icarus/plans`, live `ai:icarus.graph` |

**Facade wiring:** `IcarusFacade.js` constructs one graph store per `projectId` and injects it into scheduler, watchdog, checkpoints, and world sync.

## Plan graph hierarchy

| Concept | Graph node | Notes |
|---------|------------|--------|
| **Project** | `IcarusProject` + `project_id` on Plan/Task | Conductor `projectId` scopes all Icarus state |
| **Plan** | `Plan` | Top-level deliverable; `HAS_PLAN` from project |
| **Phase** | `Task` with `kind: 'phase'` | Optional grouping; use `PARENT` for nested work |
| **Task** | `Task` with `kind: 'work'` (default) | Scheduler `readySet` unit |

Helpers on `PlanGraphStore` / `MemoryPlanGraphStore`:

- `listPhases(planId)` — tasks where `kind === 'phase'`
- `taskHierarchy(planId)` — nested tree via `PARENT` edges
- `projectHierarchy()` — all plans for `projectId` with phase/task trees

## Live graph / UI

Websocket (allowlisted): `ai:icarus.graph` (coalesced subgraph), `ai:icarus.task`, `ai:icarus.tool`, `ai:icarus.bench`.

Optimizations on the hot path: memory store indexes `BEFORE`/`MUTEX`; wave DAGs use barrier nodes. See `worker/ai_manager/docs/icarus.md`.

## Environment

| Variable | Effect |
|----------|--------|
| `NEO4J_URI` | Production graph SoR |
| `ICARUS_GRAPH_MEMORY=1` | Force in-memory graph (unit tests, dev without Neo4j) |
| `ICARUS_C0_SKIP_LIVE` | E2E skips live conductor |

## Related

- [icarus.md](../runbooks/icarus.md) — operator runbook
- [provider-seams.md](./provider-seams.md) — shared worker kernel (request id, metrics)
- [../guides/icarus.md](../guides/icarus.md) — user-facing guide

'use strict';

/**
 * Facade wiring recursive agents + recursive context for a project.
 */

const { createPlanGraphStore, ensureSchema } = require('./graph/PlanGraphStore');
const { UserContextGate } = require('./UserContextGate');
const { SchedulerService } = require('./SchedulerService');
const { WatchdogService } = require('./WatchdogService');
const { CheckpointService } = require('./CheckpointService');
const { ExplainService } = require('./ExplainService');
const { TeachByDemo } = require('./TeachByDemo');
const { WorldSync } = require('./WorldSync');
const { skills } = require('./SkillRegistry');
const { ledger } = require('./ActionLedger');
const { charter } = require('./CharterService');
const { energy } = require('./EnergyRouter');
const { marketplace } = require('./SkillMarketplace');
const { uxSlo } = require('./UxSlo');
const { gatewayFor } = require('./AgentGateway');
const { PrReviewService } = require('./PrReviewService');
const { loraTrain } = require('./LoraTrainService');
const { layaDecision } = require('./LayaDecisionService');
const { flowIntake } = require('./FlowIntakeService');

const projects = new Map();

function forProject(projectId, settings = {}) {
  const key = String(projectId);
  if (projects.has(key)) return projects.get(key);

  const graph = createPlanGraphStore(projectId);
  const gate = new UserContextGate({ laya: layaDecision });
  const checkpoints = new CheckpointService({ graph });
  const explain = new ExplainService({ graph, ledger });
  const teach = new TeachByDemo({ skills });
  const world = new WorldSync({ graph });
  const prReviews = new PrReviewService();
  const facadeRef = { runtime: null };

  const scheduler = new SchedulerService({
    graph,
    maxParallel: Number(settings.max_parallel_workers || 3) || 3,
    spawn: async (task) => {
      ledger.append({
        projectId,
        lane: 'execute',
        tool: 'scheduler_spawn',
        args: { task_id: task.id, title: task.title },
        after: { status: 'running' },
      });
      const agentId = task.agent_id || task.meta?.agent_id || settings.default_agent_id;
      if (agentId && facadeRef.runtime) {
        try {
          await facadeRef.runtime.spawnWorker(projectId, agentId, {
            persona: task.persona || 'dev',
            objective: task.title || task.objective || '',
            claim_prefix: task.claim_prefix || task.claim || '',
            work_item_id: task.work_item_id || '',
          });
          if (graph.setTaskStatus) await graph.setTaskStatus(task.id, 'running');
        } catch { /* ledger already recorded */ }
      }
    },
  });
  const watchdog = new WatchdogService({
    graph,
    onNudge: async (ev) => {
      ledger.append({
        projectId, lane: 'safety', tool: 'watchdog_nudge', args: ev,
      });
    },
    onRegroup: async (ev) => {
      ledger.append({
        projectId, lane: 'plan', tool: 'watchdog_regroup', args: ev,
      });
    },
  });

  const facade = {
    projectId,
    graph,
    gate,
    scheduler,
    watchdog,
    checkpoints,
    explain,
    teach,
    world,
    prReviews,
    loraTrain,
    laya: layaDecision,
    flowIntake,
    skills,
    ledger,
    charter,
    energy,
    marketplace,
    uxSlo,
    bindRuntime(runtime) { facadeRef.runtime = runtime; },
    gateway: () => gatewayFor(projectId, settings),
    async boot() {
      try { await ensureSchema(); } catch { /* optional until Neo4j up */ }
      watchdog.start();
      return { ok: true };
    },
  };
  projects.set(key, facade);
  return facade;
}

module.exports = { forProject, projects };

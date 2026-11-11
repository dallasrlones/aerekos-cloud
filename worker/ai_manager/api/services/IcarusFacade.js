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

const projects = new Map();

function forProject(projectId, settings = {}) {
  const key = String(projectId);
  if (projects.has(key)) return projects.get(key);

  const graph = createPlanGraphStore(projectId);
  const gate = new UserContextGate();
  const checkpoints = new CheckpointService({ graph });
  const explain = new ExplainService({ graph, ledger });
  const teach = new TeachByDemo({ skills });
  const world = new WorldSync({ graph });
  const prReviews = new PrReviewService();
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
    skills,
    ledger,
    charter,
    energy,
    marketplace,
    uxSlo,
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

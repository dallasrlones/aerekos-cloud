'use strict';

const { randomUUID } = require('crypto');
const { skills } = require('./SkillRegistry');
const { ledger } = require('./ActionLedger');
const { energy } = require('./EnergyRouter');
const {
  TRAINER, planDistribute, routeForBase, normalizeBase,
} = require('./LoraDistribute');

/**
 * Fine-tune coding + higher (manager/review) models for Icarus tool calls.
 *
 * Trainer is always Orin:
 *  - Qwen (Orin brain): train on Orin → pin on Orin
 *  - Gemma4 (prod/dev minis): train on Orin → move adapter to minis
 */

const TRAIN_HOST = TRAINER.id;

const TOOL_CURRICULA = {
  coding: [
    'open_pr', 'git_commit', 'git_checkout', 'git_status', 'git_diff',
    'file_read', 'file_edit', 'file_write', 'grep', 'semantic_search',
    'run_checks', 'report_manager', 'shell',
  ],
  manager: [
    'approve_pr', 'spawn_worker', 'replan_worker', 'preview', 'propose_plan',
    'propose_deploy', 'report_user', 'learn_propose', 'file_read', 'grep',
    'semantic_search', 'lora_propose',
  ],
  review: [
    'approve_pr', 'file_read', 'git_diff', 'grep', 'semantic_search',
  ],
  user: [
    'submit_brief', 'update_brief', 'propose_plan', 'revise_plan',
    'open_ask', 'open_plan_q', 'file_read', 'grep', 'semantic_search',
    'plan_query', 'plan_ready', 'plan_subgraph',
  ],
};

/** Default base model by agent kind — Qwen on Orin for manager/review/coding brain. */
const DEFAULT_BASE = {
  coding: 'qwen',
  manager: 'qwen',
  review: 'qwen',
  user: 'gemma4', // hangout on minis; still trained on Orin then moved
};

class LoraTrainService {
  constructor() {
    this.jobs = new Map();
  }

  curriculumFor(kind) {
    const k = String(kind || 'coding');
    if (k === 'worker') return TOOL_CURRICULA.coding;
    return TOOL_CURRICULA[k] || TOOL_CURRICULA.coding;
  }

  propose({
    projectId,
    agentKind = 'coding',
    datasetPreview,
    adapterName,
    epochs = 1,
    baseModel,
    targets,
  }) {
    const kind = ['coding', 'worker', 'manager', 'review', 'user'].includes(agentKind)
      ? (agentKind === 'worker' ? 'coding' : agentKind)
      : 'coding';
    const base = normalizeBase(baseModel || DEFAULT_BASE[kind] || 'qwen');
    const route = routeForBase(base);
    const tools = this.curriculumFor(kind);
    const preview = String(datasetPreview || '').slice(0, 4000)
      || `Tool-call examples for ${kind} (${base}): ${tools.join(', ')}`;

    const distributeHint = planDistribute({
      adapterName: adapterName || `${kind}-${base}-tools`,
      agentKind: kind,
      baseModel: base,
      targets,
      adapterPath: '',
    });

    return {
      ask: true,
      type: 'lora_train',
      train_host: TRAIN_HOST,
      project_id: projectId,
      agent_kind: kind,
      base_model: base,
      adapter_name: adapterName || `${kind}-${base}-tools`,
      epochs: Number(epochs) || 1,
      tools,
      dataset_preview: preview,
      distribute: distributeHint,
      message: route.move
        ? `Fine-tune ${kind} (${base}) on Orin, then move adapter to ${route.serve_on.join('/')}?`
        : `Fine-tune ${kind} (${base}) on Orin and pin in place for Qwen?`,
      created_at: Date.now(),
    };
  }

  enqueue({
    projectId, agentId, agentKind, adapterName, epochs, dataset, baseModel, targets,
  }) {
    const kind = agentKind === 'worker' ? 'coding' : agentKind;
    const base = normalizeBase(baseModel || DEFAULT_BASE[kind] || 'qwen');
    const id = randomUUID();
    const name = adapterName || `${kind}-${base}-tools`;
    const job = {
      id,
      project_id: projectId,
      agent_id: agentId || '',
      agent_kind: kind,
      adapter_name: name,
      base_model: base,
      epochs: Number(epochs) || 1,
      train_host: TRAIN_HOST,
      status: 'queued',
      dataset_bytes: Buffer.byteLength(String(dataset || ''), 'utf8'),
      tools: this.curriculumFor(kind),
      targets: targets || null,
      distribute: null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };
    this.jobs.set(id, job);
    ledger.append({
      projectId,
      agentId,
      lane: 'train',
      tool: 'lora_train_enqueue',
      args: {
        job_id: id,
        agent_kind: kind,
        base_model: base,
        train_host: TRAIN_HOST,
        adapter: name,
      },
      after: { status: 'queued' },
    });
    energy.record(projectId, 0); // Orin local — no cloud spend
    return job;
  }

  update(jobId, patch = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return null;
    Object.assign(job, patch, { updated_at: Date.now() });
    if (job.status === 'succeeded' && job.adapter_path) {
      job.distribute = planDistribute({
        adapterPath: job.adapter_path,
        adapterName: job.adapter_name,
        version: job.adapter_version || job.id.slice(0, 8),
        targets: job.targets,
        agentKind: job.agent_kind,
        baseModel: job.base_model,
      });
      skills.pin(job.project_id, job.agent_kind, {
        skillId: job.skill_id || '',
        adapterPath: job.adapter_path,
        version: job.adapter_version || job.id.slice(0, 8),
      });
      skills.upsert({
        name: `lora:${job.adapter_name}`,
        kind: 'lora',
        body: `Orin-trained ${job.base_model} adapter for ${job.agent_kind} tool calls`,
        provenance: {
          train_host: TRAIN_HOST,
          base_model: job.base_model,
          job_id: job.id,
          tools: job.tools,
          distribute: job.distribute,
          project_id: job.project_id,
        },
      });
      ledger.append({
        projectId: job.project_id,
        agentId: job.agent_id,
        lane: 'train',
        tool: 'lora_distribute_plan',
        args: { job_id: job.id, distribute: job.distribute },
        after: { status: 'distribute_pending' },
      });
    }
    return job;
  }

  /** Mark a distribute step (copy Orin→mini or pin_local for Qwen) done/failed. */
  markDistributeStep(jobId, stepIndex, status, meta = {}) {
    const job = this.jobs.get(jobId);
    if (!job?.distribute?.steps?.[stepIndex]) return null;
    job.distribute.steps[stepIndex] = {
      ...job.distribute.steps[stepIndex],
      status,
      ...meta,
      at: Date.now(),
    };
    job.updated_at = Date.now();
    return job;
  }

  get(jobId) {
    return this.jobs.get(jobId) || null;
  }

  list(projectId) {
    return [...this.jobs.values()]
      .filter((j) => j.project_id === projectId)
      .sort((a, b) => b.created_at - a.created_at);
  }

  targets() {
    return {
      train_host: TRAIN_HOST,
      kinds: ['coding', 'manager', 'review', 'user'],
      bases: {
        qwen: 'Train + serve on Orin',
        gemma4: 'Train on Orin → move to prod-mini / dev-mini',
        gemma: 'Train on Orin → move to minis',
      },
      note: 'Orin trains everything. Qwen stays on Orin; Gemma4 adapters move to prod/dev boxes.',
      curricula: TOOL_CURRICULA,
      defaults: DEFAULT_BASE,
    };
  }
}

const loraTrain = new LoraTrainService();

module.exports = {
  LoraTrainService, loraTrain, TOOL_CURRICULA, TRAIN_HOST, DEFAULT_BASE,
};

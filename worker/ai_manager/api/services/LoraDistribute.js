'use strict';

/**
 * Orin is the trainer for every LoRA.
 *
 *  - Qwen on Orin: train on Orin → pin/reload on Orin (no hop).
 *  - Gemma4 on prod/dev minis: train on Orin (faster) → copy adapter over → reload.
 *
 * Coding + higher (manager/review) models may both get tool-call adapters.
 */

const TRAINER = {
  id: 'orin',
  role: 'trainer',
  note: 'All LoRA / tool-call fine-tunes run on Orin — faster than training on minis.',
};

/** Base model → default serve host(s) after Orin train. */
const MODEL_ROUTES = {
  qwen: {
    base_family: 'qwen',
    train_on: 'orin',
    serve_on: ['orin'],
    move: false,
    note: 'Qwen lives on Orin — train + serve in place',
  },
  gemma: {
    base_family: 'gemma',
    train_on: 'orin',
    serve_on: ['prod-mini', 'dev-mini'],
    move: true,
    note: 'Train Gemma/Gemma4 on Orin, move adapter to minis',
  },
  gemma4: {
    base_family: 'gemma4',
    train_on: 'orin',
    serve_on: ['prod-mini', 'dev-mini'],
    move: true,
    note: 'Train Gemma4 on Orin, move adapter to prod/dev boxes',
  },
};

const INFER_TARGETS = {
  orin: {
    id: 'orin',
    role: 'infer+train',
    models: ['qwen', 'gemma', 'gemma4'],
    note: 'Orin serves Qwen (primary) and can hold adapters locally',
  },
  'prod-mini': {
    id: 'prod-mini',
    role: 'infer',
    models: ['gemma', 'gemma4'],
    note: 'Prod Gemma box — receive adapter after Orin train',
  },
  'dev-mini': {
    id: 'dev-mini',
    role: 'infer',
    models: ['gemma', 'gemma4'],
    note: 'Dev Gemma box — receive adapter after Orin train',
  },
};

function normalizeBase(baseModel = '') {
  const b = String(baseModel || '').toLowerCase();
  if (/qwen/.test(b)) return 'qwen';
  if (/gemma\s*4|gemma4/.test(b)) return 'gemma4';
  if (/gemma/.test(b)) return 'gemma';
  return b || 'qwen';
}

function routeForBase(baseModel) {
  const key = normalizeBase(baseModel);
  return MODEL_ROUTES[key] || {
    base_family: key,
    train_on: 'orin',
    serve_on: ['orin'],
    move: false,
    note: 'Default: train + serve on Orin',
  };
}

function resolveTargets(spec, baseModel) {
  if (spec && spec.length) {
    return spec.map((s) => {
      const key = String(s).toLowerCase();
      if (INFER_TARGETS[key]) return INFER_TARGETS[key];
      return {
        id: key, role: 'infer', models: [normalizeBase(baseModel)], note: 'custom target',
      };
    });
  }
  const route = routeForBase(baseModel);
  return route.serve_on.map((id) => INFER_TARGETS[id] || {
    id, role: 'infer', models: [route.base_family],
  });
}

/**
 * Control-plane distribute plan after Orin training succeeds.
 */
function planDistribute({
  adapterPath, adapterName, version, targets, agentKind, baseModel = 'qwen',
}) {
  const route = routeForBase(baseModel);
  const dests = resolveTargets(targets, baseModel);
  const steps = [
    {
      step: 'train',
      host: TRAINER.id,
      base_model: route.base_family,
      status: 'done_or_queued',
    },
  ];

  for (const t of dests) {
    if (t.id === TRAINER.id && !route.move) {
      steps.push({
        step: 'pin_local',
        host: t.id,
        path: adapterPath,
        dest_path: adapterPath || `/models/lora/${adapterName || 'adapter'}`,
        reload: true,
        status: 'pending',
        note: 'Qwen on Orin — no copy hop',
      });
    } else if (t.id === TRAINER.id) {
      steps.push({
        step: 'pin_local',
        host: t.id,
        path: adapterPath,
        reload: true,
        status: 'pending',
      });
    } else {
      steps.push({
        step: 'copy',
        from: TRAINER.id,
        to: t.id,
        path: adapterPath,
        dest_path: `/models/lora/${adapterName || 'adapter'}`,
        reload: true,
        status: 'pending',
        note: `Move ${route.base_family} adapter Orin → ${t.id}`,
      });
    }
  }

  return {
    train_host: TRAINER.id,
    base_model: route.base_family,
    move: route.move,
    adapter_name: adapterName,
    adapter_path: adapterPath,
    version: version || '',
    agent_kind: agentKind || 'coding',
    steps,
    message: route.move
      ? `Train ${route.base_family} on Orin; copy to ${dests.map((t) => t.id).join(', ')} and reload.`
      : `Train ${route.base_family} on Orin and pin/reload in place (Qwen).`,
    created_at: Date.now(),
  };
}

module.exports = {
  TRAINER,
  INFER_TARGETS,
  MODEL_ROUTES,
  normalizeBase,
  routeForBase,
  resolveTargets,
  planDistribute,
};

'use strict';

/**
 * Energy / cost routing — prefer cheap local models; escalate for hard tasks.
 */

const TIERS = {
  local_mini: { cost: 0.1, latency_ms: 200, capacity: 'chat|classify|gate' },
  local_orin: { cost: 1, latency_ms: 800, capacity: 'code|plan|manager|review|train' },
  cloud_large: { cost: 10, latency_ms: 2000, capacity: 'hard|long_context' },
};

function pickTier({
  lane, complexity = 1, preferLocal = true, budgetLeft = Infinity,
} = {}) {
  // LoRA / tool-call fine-tunes always on Orin
  if (lane === 'train') {
    return { tier: 'local_orin', ...TIERS.local_orin, purpose: 'lora_train' };
  }
  if (lane === 'user' || lane === 'compact') {
    if (budgetLeft >= TIERS.local_mini.cost) return { tier: 'local_mini', ...TIERS.local_mini };
  }
  if ((lane === 'manager' || lane === 'plan' || lane === 'review' || complexity >= 2) && preferLocal) {
    if (budgetLeft >= TIERS.local_orin.cost) return { tier: 'local_orin', ...TIERS.local_orin };
  }
  if (complexity >= 4 && budgetLeft >= TIERS.cloud_large.cost) {
    return { tier: 'cloud_large', ...TIERS.cloud_large };
  }
  return { tier: 'local_orin', ...TIERS.local_orin };
}

class EnergyRouter {
  constructor() {
    this.spend = new Map(); // projectId -> usd today
  }

  spendToday(projectId) {
    return this.spend.get(projectId) || 0;
  }

  record(projectId, usd) {
    this.spend.set(projectId, this.spendToday(projectId) + Number(usd || 0));
  }

  route(projectId, opts = {}) {
    const budgetLeft = (opts.cap ?? 50) - this.spendToday(projectId);
    return pickTier({ ...opts, budgetLeft });
  }
}

const energy = new EnergyRouter();

module.exports = {
  EnergyRouter, energy, pickTier, TIERS,
};

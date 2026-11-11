'use strict';

/**
 * Sub-second UX SLOs for gate classify + first token targets.
 */

const SLO = {
  gate_classify_ms: 100,
  first_token_user_ms: 800,
  dual_stream_ack_ms: 200,
  graph_ready_query_ms: 500,
  gateway_enqueue_ms: 10, // allow jest/CI noise; local bench usually ~0.02ms p95
  scheduler_tick_ms: 50,
  pr_heuristic_ms: 20,
  lora_plan_ms: 10,
};

class UxSlo {
  constructor() {
    this.samples = [];
  }

  record(name, ms, meta = {}) {
    const target = SLO[name];
    const row = {
      name,
      ms: Number(ms),
      target,
      ok: target == null ? true : Number(ms) <= target,
      at: Date.now(),
      ...meta,
    };
    this.samples.push(row);
    if (this.samples.length > 500) this.samples.shift();
    return row;
  }

  summary() {
    const by = {};
    for (const s of this.samples) {
      if (!by[s.name]) by[s.name] = { n: 0, ok: 0, p50: [], target: s.target };
      by[s.name].n += 1;
      if (s.ok) by[s.name].ok += 1;
      by[s.name].p50.push(s.ms);
    }
    const out = {};
    for (const [k, v] of Object.entries(by)) {
      const sorted = v.p50.sort((a, b) => a - b);
      out[k] = {
        n: v.n,
        ok_rate: v.n ? v.ok / v.n : 1,
        p50_ms: sorted[Math.floor(sorted.length / 2)] || 0,
        target_ms: v.target,
      };
    }
    return { slo: SLO, metrics: out };
  }
}

const uxSlo = new UxSlo();

module.exports = { UxSlo, uxSlo, SLO };

'use strict';

/**
 * Per-project token and USD spend caps — deny tool/LLM work when exceeded.
 */

const { charter } = require('./CharterService');
const { energy } = require('./EnergyRouter');

const DEFAULT_TOKEN_CAP_DAY = Number(process.env.ICARUS_TOKEN_CAP_DAY || 2_000_000);

class SpendCapService {
  constructor({ charter: charterRef, energy: energyRef } = {}) {
    this.charter = charterRef || charter;
    this.energy = energyRef || energy;
    /** @type {Map<string, number>} */
    this.tokensByProject = new Map();
    this.dayKey = () => new Date().toISOString().slice(0, 10);
    this._tokenDay = this.dayKey();
  }

  _rollDay() {
    const d = this.dayKey();
    if (d !== this._tokenDay) {
      this._tokenDay = d;
      this.tokensByProject.clear();
    }
  }

  caps(projectId) {
    const c = this.charter.get(projectId);
    return {
      spend_cap_usd_day: c.spend_cap_usd_day ?? 50,
      token_cap_day: c.token_cap_day ?? DEFAULT_TOKEN_CAP_DAY,
    };
  }

  tokensToday(projectId) {
    this._rollDay();
    return this.tokensByProject.get(String(projectId)) || 0;
  }

  recordTokens(projectId, tokens) {
    this._rollDay();
    const key = String(projectId);
    const next = this.tokensToday(key) + Math.max(0, Number(tokens) || 0);
    this.tokensByProject.set(key, next);
    return next;
  }

  recordSpend(projectId, usd) {
    this.energy.record(projectId, usd);
    return this.energy.spendToday(projectId);
  }

  /**
   * @returns {{ allow: boolean, reason?: string, denied?: boolean, spend_usd?: number, tokens?: number }}
   */
  check(projectId, { estimatedTokens = 0, action = 'tool' } = {}) {
    const pid = String(projectId || '');
    const caps = this.caps(pid);
    const spend = this.energy.spendToday(pid);
    const tokens = this.tokensToday(pid);
    const est = Math.max(0, Number(estimatedTokens) || 0);

    if (caps.spend_cap_usd_day != null && spend >= Number(caps.spend_cap_usd_day)) {
      return { allow: false, denied: true, reason: 'spend_cap', spend_usd: spend, tokens };
    }

    if (caps.token_cap_day != null && tokens + est > Number(caps.token_cap_day)) {
      return { allow: false, denied: true, reason: 'token_cap', spend_usd: spend, tokens };
    }

    const charterHit = this.charter.check(pid, action, { spend_usd_today: spend });
    if (!charterHit.allow && !charterHit.ask) {
      return { allow: false, denied: true, reason: charterHit.reason || 'charter_deny', spend_usd: spend, tokens };
    }

    return { allow: true, spend_usd: spend, tokens };
  }

  /** Deny mutating tools when caps exceeded (fail closed). */
  checkTool(projectId, name, { estimatedTokens = 500 } = {}) {
    const writeish = /write|shell|deploy|apply|push|ingest|invoke/i.test(String(name));
    const est = writeish ? estimatedTokens : Math.min(estimatedTokens, 50);
    return this.check(projectId, { estimatedTokens: est, action: `tool:${name}` });
  }
}

const spendCap = new SpendCapService();

module.exports = { SpendCapService, spendCap, DEFAULT_TOKEN_CAP_DAY };

'use strict';

const { dueCron } = require('./cronMatch');
const { SYSTEM_PROJECT_ID } = require('./layerContext');

class AgentCronTicker {
  constructor(deps = {}) {
    this.runtime = deps.runtime;
    this.agents = deps.agents;
    this.intervalMs = deps.intervalMs || 60 * 1000;
    this._timer = null;
  }

  start() {
    if (process.env.SKIP_CRON === '1' || process.env.SKIP_CRON === 'true') return { started: false };
    if (this._timer) return { started: true, already: true };
    this._timer = setInterval(() => { void this.tick({ catchup: false }); }, this.intervalMs);
    if (this._timer.unref) this._timer.unref();
    return { started: true };
  }

  stop() {
    if (this._timer) clearInterval(this._timer);
    this._timer = null;
  }

  async tick({ catchup = false, now = new Date() } = {}) {
    if (!this.agents?.listAll) return { fired: [] };
    const agents = await this.agents.listAll();
    const fired = [];
    const later = [];
    for (const a of agents || []) {
      const rows = await this.agents.listCron(a.project_id, a.id);
      for (const row of rows || []) {
        const d = dueCron(row, now, { catchup });
        if (!d.due) continue;
        const handoff = typeof row.handoff === 'string' ? JSON.parse(row.handoff || '{}') : (row.handoff || {});
        const item = { cron: row, agent: a, late: d.late, label: d.label, handoff };
        if (handoff.kind === 'idle_review') later.push(item);
        else fired.push(item);
      }
    }
    const ordered = [...fired, ...later];
    const results = [];
    for (const item of ordered) {
      if (!this.runtime?.fireCron) continue;
      try {
        results.push(await this.runtime.fireCron(item.agent.project_id, item.agent.id, item.cron.id, {
          late: item.late,
          label: item.label,
        }));
      } catch (e) {
        results.push({ ok: false, error: e.message, cron_id: item.cron.id });
      }
    }
    return { fired: results };
  }

  static defaultIdleCron(projectId, agentName) {
    if (projectId !== SYSTEM_PROJECT_ID) return null;
    if (String(agentName || 'icarus') !== 'icarus') return null;
    return {
      name: 'idle-review',
      kind: 'recurring',
      schedule: '0 4 * * *',
      timezone: 'America/Los_Angeles',
      enabled: 'true',
      handoff: { kind: 'idle_review', objective: 'cheap scan Computer and propose one small plan' },
    };
  }
}

module.exports = { AgentCronTicker };

'use strict';

/**
 * Teach-by-demo: capture user demonstration → skill draft → ASK to promote.
 */

const { randomUUID } = require('crypto');

class TeachByDemo {
  constructor({ skills } = {}) {
    this.skills = skills;
    this.sessions = new Map();
  }

  start(projectId, { title } = {}) {
    const id = randomUUID();
    const session = {
      id,
      project_id: projectId,
      title: title || 'demo',
      steps: [],
      status: 'recording',
      created_at: Date.now(),
    };
    this.sessions.set(id, session);
    return session;
  }

  addStep(sessionId, step) {
    const s = this.sessions.get(sessionId);
    if (!s || s.status !== 'recording') return null;
    s.steps.push({
      at: Date.now(),
      tool: step.tool,
      args: step.args,
      note: step.note || '',
    });
    return s;
  }

  finish(sessionId) {
    const s = this.sessions.get(sessionId);
    if (!s) return null;
    s.status = 'draft';
    const body = s.steps.map((st, i) => `${i + 1}. ${st.tool} ${JSON.stringify(st.args || {})}${st.note ? ` — ${st.note}` : ''}`).join('\n');
    const skill = this.skills?.upsert({
      name: `demo:${s.title}`,
      kind: 'prompt',
      body: `Taught by demo:\n${body}`,
      provenance: { teach_session: sessionId, project_id: s.project_id },
    });
    s.skill_id = skill?.id;
    s.ask = {
      type: 'promote_skill',
      message: 'Promote this taught skill for the agent?',
      skill_id: skill?.id,
    };
    return s;
  }

  get(sessionId) {
    return this.sessions.get(sessionId) || null;
  }
}

module.exports = { TeachByDemo };

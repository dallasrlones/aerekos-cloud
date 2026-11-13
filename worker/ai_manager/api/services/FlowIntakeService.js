'use strict';

/**
 * Persist guided Flow intake state per agent until confirm/cancel.
 */

const { layaDecision, FLOW_SLOTS } = require('./LayaDecisionService');

function json(v, d = {}) {
  if (v == null) return d;
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch { return d; }
}

class FlowIntakeService {
  constructor(agents) {
    this.agents = agents || null;
  }

  _svc() {
    if (!this.agents) {
      // lazy to avoid circular require
      const { AgentService } = require('./AgentService');
      this.agents = new AgentService();
    }
    return this.agents;
  }

  async getState(agent) {
    const opts = json(agent.options, {});
    return opts.flow_intake || null;
  }

  async setState(projectId, agent, intake) {
    const opts = json(agent.options, {});
    if (!intake) delete opts.flow_intake;
    else opts.flow_intake = { ...intake, updated_at: new Date().toISOString() };
    const updated = await this._svc().update(agent.id, projectId, { options: opts });
    return json(updated?.options || opts, {}).flow_intake || null;
  }

  async start(projectId, agent, flowId) {
    if (!FLOW_SLOTS[flowId]) {
      const e = new Error(`unknown flow ${flowId}`);
      e.status = 400;
      throw e;
    }
    return this.setState(projectId, agent, {
      flow_id: flowId,
      slots: {},
      status: 'intake',
    });
  }

  async cancel(projectId, agent) {
    return this.setState(projectId, agent, null);
  }

  /**
   * Apply user utterance; returns { intake, ask|confirm, laya }.
   */
  async advance(projectId, agent, utterance, { flowId } = {}) {
    let intake = await this.getState(agent);
    const text = String(utterance || '').trim();

    if (!intake || intake.status === 'done') {
      const pick = await layaDecision.predict(
        { text },
        { flow_pick: { options: layaDecision.packs().flow_pick.options } },
      );
      const choice = pick.answers.flow_pick?.choice || flowId || 'none';
      if (choice === 'none' && !flowId) {
        return { intake: null, ask: null, flow: null, laya: pick };
      }
      const fid = flowId || choice;
      intake = await this.start(projectId, agent, fid);
    }

    const fid = intake.flow_id;
    const slots = layaDecision.mergeSlots(fid, intake.slots || {}, text);
    intake = await this.setState(projectId, agent, { ...intake, slots, status: 'intake' });

    const next = await layaDecision.predict(
      { text, flowId: fid, slots },
      { intake_next: { options: layaDecision.packs().intake_next.options } },
    );
    const ask = layaDecision.intakeAsk(fid, slots);
    if (ask?.ready || next.answers.intake_next?.choice === 'ready_to_act') {
      const filled = {
        ...((FLOW_SLOTS[fid] || {}).defaults || {}),
        ...slots,
      };
      intake = await this.setState(projectId, agent, {
        ...intake,
        slots: filled,
        status: 'confirm',
      });
      return {
        intake,
        confirm: {
          text: ask?.summary || layaDecision._summary(fid, filled),
          options: ['Yes', 'No', 'Other'],
          recommended: 'Yes',
          kind: 'flow_confirm',
          flow_id: fid,
          slots: filled,
        },
        laya: next,
      };
    }

    if (!ask || !ask.text) {
      return {
        intake,
        ask: {
          text: `Tell me more to continue the ${fid} setup.`,
          options: ['Other'],
          recommended: 'Other',
          kind: 'flow_intake',
          flow_id: fid,
          field: null,
        },
        laya: next,
      };
    }

    return {
      intake,
      ask: {
        text: ask.text,
        options: ask.options || ['Other'],
        recommended: ask.recommended || 'Other',
        kind: 'flow_intake',
        flow_id: fid,
        field: ask.field,
        from_layer: 'user',
        speak_text: ask.text,
        payload: { flow_id: fid, field: ask.field, slots },
      },
      laya: next,
    };
  }

  async markDone(projectId, agent) {
    const intake = await this.getState(agent);
    if (!intake) return null;
    return this.setState(projectId, agent, { ...intake, status: 'done' });
  }
}

const flowIntake = new FlowIntakeService();

module.exports = { FlowIntakeService, flowIntake, FLOW_SLOTS };

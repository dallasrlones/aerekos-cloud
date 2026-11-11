'use strict';

const { randomUUID } = require('crypto');

/**
 * Versioned skills + adapter pins (Hermes-style). Provenance for LoRA learn path.
 */

class SkillRegistry {
  constructor() {
    this.skills = new Map(); // id -> skill
    this.pins = new Map(); // projectId:agentKind -> { skillId, adapterPath, version }
  }

  upsert(skill) {
    const id = skill.id || randomUUID();
    const row = {
      id,
      name: skill.name,
      version: skill.version || '1.0.0',
      kind: skill.kind || 'prompt', // prompt | tool | lora
      body: skill.body || '',
      rag_refs: skill.rag_refs || [],
      privacy: skill.privacy || 'project',
      provenance: skill.provenance || {},
      created_at: skill.created_at || Date.now(),
      updated_at: Date.now(),
    };
    this.skills.set(id, row);
    return row;
  }

  get(id) { return this.skills.get(id) || null; }

  list({ kind } = {}) {
    let rows = [...this.skills.values()];
    if (kind) rows = rows.filter((s) => s.kind === kind);
    return rows.sort((a, b) => b.updated_at - a.updated_at);
  }

  pin(projectId, agentKind, { skillId, adapterPath, version }) {
    const key = `${projectId}:${agentKind}`;
    const pin = {
      project_id: projectId,
      agent_kind: agentKind,
      skill_id: skillId,
      adapter_path: adapterPath || '',
      version: version || '',
      pinned_at: Date.now(),
    };
    this.pins.set(key, pin);
    return pin;
  }

  getPin(projectId, agentKind) {
    return this.pins.get(`${projectId}:${agentKind}`) || null;
  }

  /**
   * LoRA learn path: dataset preview → ASK → Orin GPU queue.
   * Both coding and higher (manager/review) models can be fine-tuned for tool calls.
   */
  proposeLearn({
    projectId, datasetPreview, adapterName, epochs, agentKind = 'coding',
  }) {
    const { loraTrain } = require('./LoraTrainService');
    return loraTrain.propose({
      projectId,
      agentKind,
      datasetPreview,
      adapterName,
      epochs,
    });
  }
}

const singleton = new SkillRegistry();

module.exports = { SkillRegistry, skills: singleton };

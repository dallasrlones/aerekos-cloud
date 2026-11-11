'use strict';

/**
 * Live world sync — attach facts from tools/web into the plan graph.
 */

class WorldSync {
  constructor({ graph } = {}) {
    this.graph = graph;
    this.buffer = [];
  }

  async ingest(projectId, {
    entityId, text, source, meta,
  }) {
    const fact = {
      project_id: projectId,
      entity_id: entityId,
      text,
      source: source || 'tool',
      meta: meta || {},
      at: Date.now(),
    };
    this.buffer.push(fact);
    if (this.graph?.attachWorldFact && entityId) {
      await this.graph.attachWorldFact(entityId, fact);
    }
    return fact;
  }

  recent(projectId, limit = 20) {
    return this.buffer.filter((f) => f.project_id === projectId).slice(-limit).reverse();
  }
}

module.exports = { WorldSync };

const { Item } = require('../models');
const { CrudService } = require('../../../shared/crudBase');

class ItemService extends CrudService {
  constructor() {
    super(Item);
  }

  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    const item = await this.create({
      project_id: projectId,
      name: 'app',
      flags: JSON.stringify({ example: false }),
    });
    return { item, created: true };
  }

  /**
   * Resolve a flag from a stored namespace.
   * Missing namespace or flag → `value: false` (never invents unlimited/true defaults).
   */
  async evaluate(projectId, { namespace = 'app', flag = 'example' } = {}) {
    const items = await this.list(projectId);
    const row = items.find((i) => i.name === namespace);
    let flags = {};
    try {
      flags = JSON.parse(row?.flags || '{}');
    } catch {
      flags = {};
    }
    const value = Object.prototype.hasOwnProperty.call(flags, flag) ? flags[flag] : false;
    return { namespace, flag, value };
  }
}

module.exports = { ItemService };

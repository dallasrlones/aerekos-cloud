const { Item } = require('../models');
const { CrudService } = require('../../../shared/crudBase');
class ItemService extends CrudService {
  constructor() { super(Item); }
  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    const item = await this.create({ project_id: projectId, name: 'all-clear' });
    return { item, created: true };
  }
}
module.exports = { ItemService };

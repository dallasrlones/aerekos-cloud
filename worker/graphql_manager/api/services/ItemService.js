const { Item } = require('../models');
const { CrudService } = require('../../../shared/crudBase');
class ItemService extends CrudService {
  constructor() { super(Item); }
  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    const models = {
      User: { fields: { name: 'string', email: 'string', owner_id: 'string' }, settings: { hasMany: ['Post'] } },
      Post: { fields: { title: 'string', body: 'string' }, settings: { belongsTo: ['User'] } },
    };
    const { compileSchema } = require('./compileSchema');
    const schema = compileSchema(models);
    try {
      const { proxy } = require('../../../shared/conductorProxy');
      await proxy({
        service: 'api_manager',
        method: 'POST',
        path: '/api/v1/data-apis/apply',
        projectId,
        body: { project_id: projectId, name: 'app', models },
      });
    } catch (e) {
      console.warn('[graphql_manager] data api apply skipped:', e.message);
    }
    if (items.length) {
      const existing = items.find((i) => i.name === 'app') || items[0];
      if (!existing.schema) {
        await this.update(existing.id, projectId, { schema, data_app: 'app' }).catch(() => {});
      }
      return { item: existing, created: false };
    }
    const item = await this.create({ project_id: projectId, name: 'app', schema, data_app: 'app' });
    return { item, created: true };
  }
}
module.exports = { ItemService };

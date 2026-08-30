const { Item } = require('../models');
const { CrudService } = require('../../../shared/crudBase');

function mapLimit(body) {
  const b = { ...(body || {}) };
  if (b.limit != null && b.quota_limit == null) b.quota_limit = b.limit;
  delete b.limit;
  return b;
}

class ItemService extends CrudService {
  constructor() { super(Item); }
  async create(body) {
    return super.create(mapLimit(body));
  }
  async update(id, projectIdVal, body) {
    return super.update(id, projectIdVal, mapLimit(body));
  }
  async ensureDefaults(projectId) {
    const wanted = [
      { name: 'storage_bytes', quota_limit: '1099511627776', unit: 'bytes' },
      { name: 'compute_tasks', quota_limit: '100', unit: 'tasks' },
      { name: 'git_repos', quota_limit: '100', unit: 'repos' },
      { name: 'manager_writes', quota_limit: '1000000', unit: 'writes' },
      { name: 'compute_seconds', quota_limit: '1000000', unit: 'seconds' },
    ];
    const items = await this.list(projectId);
    const names = new Set(items.map((i) => i.name));
    let created = 0;
    for (const m of wanted) {
      if (names.has(m.name)) continue;
      await this.create({ project_id: projectId, value: '0', ...m });
      created += 1;
    }
    const all = await this.list(projectId);
    return { item: all[0], created: created > 0 };
  }
}
module.exports = { ItemService };

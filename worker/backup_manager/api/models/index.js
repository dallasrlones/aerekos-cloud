const db = require('../utils/dbClient');
const Item = db.model('Item', {
    project_id: 'string',
    name: 'string',
    schedule: 'string',
    targets: 'string',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const Job = db.model('Job', {
    project_id: 'string',
    source: 'string',
    resource: 'string',
    vault: 'string',
    status: 'string',
    size_bytes: 'number',
    storage_key: 'string',
    error: 'string',
  }, { required: ['project_id', 'source', 'status'], indexes: ['project_id', 'status'], timestamps: true });

module.exports = { Item, Job, db };

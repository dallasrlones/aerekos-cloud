const db = require('../utils/dbClient');
const M = db.model('CdnRule', {
    project_id: 'string',
    name: 'string',
    path_pattern: 'string',
    origin: 'string',
    cache_ttl_seconds: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { CdnRule: M, db };

const db = require('../utils/dbClient');
const M = db.model('HostRecord', {
    project_id: 'string',
    name: 'string',
    hostname: 'string',
    address: 'string',
    role: 'string',
    metadata: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { HostRecord: M, db };

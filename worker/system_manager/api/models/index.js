const db = require('../utils/dbClient');
const M = db.model('SystemTask', {
    project_id: 'string',
    name: 'string',
    spec_json: 'string',
    state: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { SystemTask: M, db };

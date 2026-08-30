const db = require('../utils/dbClient');
const M = db.model('SecurityFinding', {
    project_id: 'string',
    name: 'string',
    severity: 'string',
    source: 'string',
    details: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { SecurityFinding: M, db };

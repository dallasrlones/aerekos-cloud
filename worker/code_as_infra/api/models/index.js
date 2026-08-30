const db = require('../utils/dbClient');
const M = db.model('IaModule', {
    project_id: 'string',
    name: 'string',
    kind: 'string',
    content: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { IaModule: M, db };

const db = require('../utils/dbClient');
const M = db.model('AppProject', {
    project_id: 'string',
    name: 'string',
    repo_url: 'string',
    build_command: 'string',
    metadata: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { AppProject: M, db };

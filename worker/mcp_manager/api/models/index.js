const db = require('../utils/dbClient');
const M = db.model('McpTool', {
    project_id: 'string',
    name: 'string',
    description: 'string',
    input_schema: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { McpTool: M, db };

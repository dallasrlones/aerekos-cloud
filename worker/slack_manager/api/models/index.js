const db = require('../utils/dbClient');
const M = db.model('SlackMessage', {
    project_id: 'string',
    name: 'string',
    channel: 'string',
    text: 'string',
    status: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { SlackMessage: M, db };

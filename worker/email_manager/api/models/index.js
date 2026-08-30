const db = require('../utils/dbClient');
const M = db.model('EmailMessage', {
    project_id: 'string',
    name: 'string',
    to_address: 'string',
    subject: 'string',
    body: 'string',
    status: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { EmailMessage: M, db };

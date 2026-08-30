const db = require('../utils/dbClient');
const M = db.model('SmsMessage', {
    project_id: 'string',
    name: 'string',
    to_number: 'string',
    body: 'string',
    status: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { SmsMessage: M, db };

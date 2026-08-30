const db = require('../utils/dbClient');
const M = db.model('AnalyticsEvent', {
    project_id: 'string',
    name: 'string',
    event: 'string',
    value: 'string',
    properties: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { AnalyticsEvent: M, db };

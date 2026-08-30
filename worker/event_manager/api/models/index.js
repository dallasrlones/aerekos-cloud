const db = require('../utils/dbClient');
const Bus = db.model('Bus', {
  project_id: 'string',
  name: 'string',
  description: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const Rule = db.model('Rule', {
  project_id: 'string',
  bus_id: 'string',
  name: 'string',
  source: 'string',
  type_pattern: 'string',
  target_kind: 'string',
  target_ref: 'string',
  enabled: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'bus_id'], timestamps: true });

module.exports = { Bus, Rule, db };

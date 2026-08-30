const db = require('../utils/dbClient');
const M = db.model('ApiRoute', {
    project_id: 'string',
    name: 'string',
    method: 'string',
    public_path: 'string',
    backend_url: 'string',
    target_service: 'string',
    target_path: 'string',
    resource_arn_template: 'string',
    required_scope: 'string',
    enabled: 'number',
    resolve_arn_at: 'string',
    desired: 'number',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const DataApi = db.model('DataApi', {
  project_id: 'string',
  name: 'string',
  database: 'string',
  engine: 'string',
  auth: 'string',
  desired: 'number',
  autoscaling: 'string',
  schema_json: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

module.exports = { ApiRoute: M, DataApi, db };

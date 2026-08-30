const db = require('../utils/dbClient');
const M = db.model('OidcProvider', {
    project_id: 'string',
    name: 'string',
    provider_type: 'string',
    issuer: 'string',
    client_id: 'string',
    config_json: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
const Credential = db.model('Credential', {
  project_id: 'string',
  name: 'string',
  client_id: 'string',
  client_secret_hash: 'string',
  allowed_resources: 'string',
  scopes: 'string',
  enabled: 'number',
  last_used_at: 'string',
}, { required: ['project_id', 'name', 'client_id'], indexes: ['project_id', 'name', 'client_id'], timestamps: true });

module.exports = { OidcProvider: M, Credential, db };

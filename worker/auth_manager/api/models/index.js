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
// Per-project human users (password grant). Apps like aerekos-tv authenticate
// their own end-users here: POST /auth/login verifies username+password and
// issues a JWT (sub `user:<id>`, typ `user`) that /auth/verify will accept.
const User = db.model('User', {
  project_id: 'string',
  username: 'string',
  name: 'string',
  display_color: 'string',
  password_hash: 'string',
  enabled: 'number',
  last_login_at: 'string',
}, { required: ['project_id', 'username'], indexes: ['project_id', 'username'], timestamps: true });

module.exports = { OidcProvider: M, Credential, User, db };

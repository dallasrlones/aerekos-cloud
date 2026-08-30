const db = require('../utils/dbClient');

const WebhookEndpoint = db.model(
  'WebhookEndpoint',
  {
    project_id: 'string',
    name: 'string',
    target_url: 'string',
    secret: 'string',
    headers: 'string',
    enabled: 'string'
  },
  {
    required: ['project_id', 'name', 'target_url'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

const WebhookDelivery = db.model(
  'WebhookDelivery',
  {
    project_id: 'string',
    endpoint_id: 'string',
    payload: 'string',
    status: 'string',
    http_status: 'string',
    error: 'string',
    response_snippet: 'string'
  },
  {
    required: ['project_id', 'endpoint_id', 'status'],
    indexes: ['project_id', 'endpoint_id'],
    timestamps: true
  }
);

module.exports = { WebhookEndpoint, WebhookDelivery, db };

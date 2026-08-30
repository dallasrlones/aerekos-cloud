const db = require('../utils/dbClient');

const Fn = db.model('Fn', {
  project_id: 'string',
  name: 'string',
  runtime: 'string',
  handler: 'string',
  timeout_ms: 'string',
  memory_mb: 'string',
  env: 'string',
  code_bucket: 'string',
  code_key: 'string',
  image: 'string',
  inbox_queue: 'string',
  dlq: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const Invocation = db.model('Invocation', {
  project_id: 'string',
  function_id: 'string',
  status: 'string',
  duration_ms: 'string',
  request_id: 'string',
  log_tail: 'string',
  error: 'string',
}, { required: ['project_id', 'function_id'], indexes: ['project_id', 'function_id'], timestamps: true });

const EventSource = db.model('EventSource', {
  project_id: 'string',
  function_id: 'string',
  kind: 'string',
  ref: 'string',
  batch_size: 'string',
  enabled: 'string',
}, { required: ['project_id', 'function_id', 'kind'], indexes: ['project_id', 'function_id'], timestamps: true });

module.exports = { Item: Fn, Fn, Invocation, EventSource, db };

const db = require('../utils/dbClient');

// action_type: 'webhook' | 'queue'
// target_url: required for webhook
// target_queue: required for queue
// request_headers: JSON string for webhook extra headers
// message_template: default body for queue or JSON string for webhook POST
const Schedule = db.model(
  'Schedule',
  {
    name: 'string',
    project_id: 'string',
    cron_expression: 'string',
    timezone: 'string',
    action_type: 'string',
    http_method: 'string',
    target_url: 'string',
    target_queue: 'string',
    message_template: 'string',
    request_headers: 'string',
    enabled: 'number',
    last_run_at: 'string',
    last_error: 'string'
  },
  {
    required: ['name', 'project_id', 'cron_expression', 'action_type'],
    unique: [['project_id', 'name']],
    timestamps: true
  }
);

module.exports = { Schedule, db };

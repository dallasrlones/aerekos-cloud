const db = require('../utils/dbClient');

const Queue = db.model(
  'Queue',
  {
    name: 'string',
    project_id: 'string',
    visibility_timeout_seconds: 'number',
    engine: 'string',
    dlq: 'string',
    max_receive: 'number',
  },
  {
    required: ['name', 'project_id'],
    unique: [['project_id', 'name']],
    timestamps: true
  }
);

const Message = db.model(
  'Message',
  {
    body: 'string',
    project_id: 'string',
    locked_until: 'string', // ISO datetime or null/empty = visible
    receive_count: 'number',
    group_id: 'string',
    dedup_id: 'string',
  },
  {
    required: ['body', 'project_id'],
    belongsTo: ['Queue'],
    timestamps: true
  }
);

module.exports = { Queue, Message, db };

const db = require('../utils/dbClient');

// Append-only project-scoped log lines (Loki-ish MVP: ingest + list with filters)
const LogEvent = db.model(
  'LogEvent',
  {
    project_id: 'string',
    source: 'string',
    level: 'string',
    message: 'string',
    context: 'string'
  },
  {
    required: ['project_id', 'level', 'message'],
    indexes: ['project_id', 'level', 'source'],
    timestamps: true
  }
);

module.exports = { LogEvent, db };

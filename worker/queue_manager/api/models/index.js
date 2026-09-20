const db = require('../utils/dbClient');

try {
  const raw = db.db || db;
  const cols = new Set(raw.prepare('PRAGMA table_info(queues)').all().map((c) => c.name));
  const add = [
    ['engine', "TEXT DEFAULT 'standard'"],
    ['dlq', "TEXT DEFAULT ''"],
    ['max_receive', 'INTEGER DEFAULT 3'],
  ];
  for (const [name, spec] of add) {
    if (!cols.has(name)) raw.exec(`ALTER TABLE queues ADD COLUMN ${name} ${spec}`);
  }
  const mcols = new Set(raw.prepare('PRAGMA table_info(messages)').all().map((c) => c.name));
  for (const [name, spec] of [['group_id', "TEXT DEFAULT ''"], ['dedup_id', "TEXT DEFAULT ''"], ['receive_count', 'INTEGER DEFAULT 0']]) {
    if (!mcols.has(name)) raw.exec(`ALTER TABLE messages ADD COLUMN ${name} ${spec}`);
  }
} catch (_) { /* table may not exist yet */ }

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

const db = require('../utils/dbClient');

// A hosted git repository (one bare repo on disk per row).
const Repository = db.model(
  'Repository',
  {
    project_id: 'string',
    name: 'string',
    description: 'string',
    default_branch: 'string',
    visibility: 'string', // always private — public is rejected on write
    last_pushed_at: 'string',
    require_approval: 'number'
  },
  {
    required: ['project_id', 'name'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

// Append-only record of pushes, written by each repo's post-receive hook.
const PushEvent = db.model(
  'PushEvent',
  {
    project_id: 'string',
    repo_id: 'string',
    ref: 'string',
    old_sha: 'string',
    new_sha: 'string',
    pusher: 'string'
  },
  {
    required: ['project_id', 'repo_id', 'ref'],
    indexes: ['project_id', 'repo_id'],
    timestamps: true
  }
);

const PullRequest = db.model(
  'PullRequest',
  {
    project_id: 'string',
    repo_id: 'string',
    title: 'string',
    source_branch: 'string',
    target_branch: 'string',
    status: 'string',
    body: 'string',
    notes: 'string'
  },
  {
    required: ['project_id', 'repo_id', 'title', 'source_branch', 'target_branch'],
    indexes: ['project_id', 'repo_id'],
    timestamps: true
  }
);

const Issue = db.model(
  'Issue',
  {
    project_id: 'string',
    repo_id: 'string',
    title: 'string',
    body: 'string',
    status: 'string',
    author: 'string'
  },
  { required: ['project_id', 'repo_id', 'title'], indexes: ['project_id', 'repo_id'], timestamps: true }
);

const PullComment = db.model(
  'PullComment',
  {
    project_id: 'string',
    pull_id: 'string',
    author: 'string',
    body: 'string',
    path: 'string',
    line: 'number'
  },
  { required: ['project_id', 'pull_id', 'body'], indexes: ['project_id', 'pull_id'], timestamps: true }
);

const PullReview = db.model(
  'PullReview',
  {
    project_id: 'string',
    pull_id: 'string',
    author: 'string',
    state: 'string',
    body: 'string'
  },
  { required: ['project_id', 'pull_id', 'state'], indexes: ['project_id', 'pull_id'], timestamps: true }
);

const CheckRun = db.model(
  'CheckRun',
  {
    project_id: 'string',
    repo_id: 'string',
    sha: 'string',
    name: 'string',
    status: 'string',
    note: 'string'
  },
  { required: ['project_id', 'repo_id', 'name'], indexes: ['project_id', 'repo_id', 'sha'], timestamps: true }
);

try {
  const cols = new Set((db.db.prepare('PRAGMA table_info(repositories)').all() || []).map((c) => c.name));
  if (!cols.has('require_approval')) db.db.exec("ALTER TABLE repositories ADD COLUMN require_approval INTEGER DEFAULT 0");
} catch (_) { /* */ }

module.exports = { Repository, PushEvent, PullRequest, Issue, PullComment, PullReview, CheckRun, db };

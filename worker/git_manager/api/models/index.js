const db = require('../utils/dbClient');

// A hosted git repository (one bare repo on disk per row).
const Repository = db.model(
  'Repository',
  {
    project_id: 'string',
    name: 'string',
    description: 'string',
    default_branch: 'string',
    visibility: 'string', // private | public  (advisory; transport auth is separate)
    last_pushed_at: 'string'
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

module.exports = { Repository, PushEvent, PullRequest, db };

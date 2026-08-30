const db = require('../utils/dbClient');
const M = db.model('CrawlJob', {
    project_id: 'string',
    name: 'string',
    start_url: 'string',
    max_depth: 'string',
    result_summary: 'string',
    state: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { CrawlJob: M, db };

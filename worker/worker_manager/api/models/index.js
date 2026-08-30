const db = require('../utils/dbClient');
const M = db.model('WorkerAnnotation', {
    project_id: 'string',
    name: 'string',
    worker_id: 'string',
    key: 'string',
    value: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { WorkerAnnotation: M, db };

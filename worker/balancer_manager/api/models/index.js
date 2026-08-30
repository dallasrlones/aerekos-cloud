const db = require('../utils/dbClient');
const M = db.model('BalancerTarget', {
    project_id: 'string',
    name: 'string',
    address: 'string',
    weight: 'string',
    pool: 'string',
    health_check_path: 'string',
    health_check_interval: 'number',
    last_health: 'string',
    healthy: 'number',
    desired: 'number'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { BalancerTarget: M, db };

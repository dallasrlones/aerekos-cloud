const db = require('../utils/dbClient');
const M = db.model('MetricSeries', {
    project_id: 'string',
    name: 'string',
    metric_name: 'string',
    value: 'string',
    labels: 'string'
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
const Alarm = db.model('MetricAlarm', {
    project_id: 'string',
    name: 'string',
    metric_name: 'string',
    threshold: 'string',
    op: 'string',
    enabled: 'string',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { MetricSeries: M, MetricAlarm: Alarm, db };

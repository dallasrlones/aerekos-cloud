const db = require('../utils/dbClient');
const Item = db.model('Item', {
    project_id: 'string',
    name: 'string',
    action: 'string',
    cidr: 'string',
    path: 'string',
    rate: 'string',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { Item, db };

const db = require('../utils/dbClient');
const Item = db.model('Item', {
    project_id: 'string',
    name: 'string',
    bucket: 'string',
    protocol: 'string',
  }, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });
module.exports = { Item, db };

'use strict';

const db = require('../utils/dbClient');

const Message = db.model(
  'Message',
  {
    project_id: 'string',
    name: 'string',
    channel: 'string',
    to_address: 'string',
    subject: 'string',
    body: 'string',
    status: 'string',
  },
  { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true }
);

const Channel = db.model(
  'Channel',
  {
    project_id: 'string',
    name: 'string',
    channel: 'string',
    config: 'string',
    status: 'string',
  },
  { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true }
);

module.exports = { Message, Channel, db };

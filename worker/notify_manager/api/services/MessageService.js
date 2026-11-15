'use strict';

const { Message } = require('../models');
const { CrudService } = require('../../../shared/crudBase');

class MessageService extends CrudService {
  constructor() {
    super(Message);
  }

  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    const item = await this.create({
      project_id: projectId,
      name: 'default-notify',
      channel: 'email',
      to_address: 'ops@example.test',
      subject: 'notify default',
      body: 'seeded by ensure-defaults',
      status: 'queued',
    });
    return { item, created: true };
  }
}

module.exports = { MessageService };

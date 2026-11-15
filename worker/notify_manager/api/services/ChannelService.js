'use strict';

const { Channel } = require('../models');
const { CrudService } = require('../../../shared/crudBase');

class ChannelService extends CrudService {
  constructor() {
    super(Channel);
  }

  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    if (items.length) return { item: items[0], created: false };
    const item = await this.create({
      project_id: projectId,
      name: 'email-default',
      channel: 'email',
      config: '{}',
      status: 'active',
    });
    return { item, created: true };
  }
}

module.exports = { ChannelService };

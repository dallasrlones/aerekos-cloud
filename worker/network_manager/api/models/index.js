const db = require('../utils/dbClient');

const ProjectNetwork = db.model(
  'ProjectNetwork',
  {
    project_id: 'string',
    name: 'string',
    docker_network_name: 'string',
    docker_network_id: 'string',
    driver: 'string',
    last_error: 'string'
  },
  {
    required: ['project_id', 'name', 'docker_network_name'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

const HeadscaleNode = db.model(
  'HeadscaleNode',
  {
    project_id: 'string',
    node_id: 'string',
    hostname: 'string',
    preauth_key: 'string',
    tags: 'string',
    status: 'string',
  },
  { timestamps: true, indexes: ['project_id', 'status'] }
);

module.exports = { ProjectNetwork, HeadscaleNode, db };

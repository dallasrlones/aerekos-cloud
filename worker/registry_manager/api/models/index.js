const db = require('../utils/dbClient');

// A per-project registry entry: where to pull/push images from.
// Credentials are NEVER stored here — reference a secrets_manager key via credential_ref.
const RegistryEntry = db.model(
  'RegistryEntry',
  {
    project_id: 'string',
    name: 'string',
    registry_url: 'string', // e.g. harbor.example.com, docker.io
    type: 'string', // local | docker_hub | harbor | embedded | custom
    namespace: 'string',
    username: 'string',
    credential_ref: 'string', // secrets_manager key name holding the password/token
    enabled: 'string' // '1' | '0'
  },
  {
    required: ['project_id', 'name', 'registry_url'],
    indexes: ['project_id', 'name'],
    timestamps: true
  }
);

const WantedImage = db.model(
  'WantedImage',
  {
    project_id: 'string',
    name: 'string',
    upstream: 'string',
    dest_tag: 'string',
    platforms: 'string',
    window: 'string',
    enabled: 'string',
    status: 'string',
    last_error: 'string',
  },
  {
    required: ['project_id', 'name'],
    indexes: ['project_id', 'name'],
    timestamps: true,
  }
);

const Artifact = db.model(
  'RegistryArtifact',
  {
    project_id: 'string',
    name: 'string',
    kind: 'string', // docker | npm | pypi
    version: 'string',
    uri: 'string',
  },
  {
    required: ['project_id', 'name', 'kind'],
    indexes: ['project_id', 'kind', 'name'],
    timestamps: true,
  }
);

module.exports = { RegistryEntry, WantedImage, Artifact, db };

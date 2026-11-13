'use strict';

/**
 * Cloud provider seam — local implementation only (aws|gcp|azure reserved).
 * @see docs/architecture/provider-seams.md
 */

const KINDS = ['local', 'aws', 'gcp', 'azure'];

function resolveProviderKind(explicit) {
  const raw =
    explicit ||
    process.env.AEREKOS_CLOUD_PROVIDER ||
    process.env.AEREKOS_PROVIDER ||
    'local';
  const k = String(raw).toLowerCase();
  return KINDS.includes(k) ? k : 'local';
}

class Provider {
  /** @param {'local'|'aws'|'gcp'|'azure'} kind */
  constructor(kind) {
    this.kind = kind;
  }

  /** Human-readable capability summary for health/debug. */
  describe() {
    return { kind: this.kind, implemented: this.kind === 'local' };
  }

  /** @returns {Provider} */
  static create(kind) {
    const resolved = resolveProviderKind(kind);
    if (resolved === 'local') return new LocalProvider();
    const e = new Error(`provider "${resolved}" is not implemented`);
    e.code = 'ProviderNotImplemented';
    e.status = 501;
    throw e;
  }
}

/**
 * Local/dev provider: Docker on worker, SQLite/FS, no external control plane.
 */
class LocalProvider extends Provider {
  constructor() {
    super('local');
  }

  describe() {
    return {
      kind: 'local',
      implemented: true,
      object_store: 'filesystem',
      secrets: 'secrets_manager',
      compute: 'docker',
    };
  }

  /** Placeholder for future object-store seam. */
  objectStoreConfig() {
    return { backend: 'local', root: process.env.AEREKOS_LOCAL_STORE || '/data' };
  }

  /** Placeholder for future KMS seam. */
  kmsConfig() {
    return { backend: 'local', via: 'key_manager' };
  }
}

module.exports = {
  KINDS,
  resolveProviderKind,
  Provider,
  LocalProvider,
};

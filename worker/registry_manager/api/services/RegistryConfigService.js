/**
 * Public, non-secret registry hints for UIs and automation.
 * Image pulls run on the **worker** via Docker; credentials belong in `~/.docker/config.json`
 * or your orchestrator — not in this API response.
 */
class RegistryConfigService {
  getPublicConfig() {
    const mode = (process.env.REGISTRY_MODE || 'local').toLowerCase();
    const validModes = ['local', 'docker_hub', 'harbor', 'embedded', 'custom'];
    const safeMode = validModes.includes(mode) ? mode : 'custom';

    return {
      mode: safeMode,
      public_base_url: (process.env.REGISTRY_PUBLIC_BASE_URL || '').trim(),
      default_namespace: (process.env.REGISTRY_DEFAULT_NAMESPACE || '').trim(),
      auth_expected: process.env.REGISTRY_AUTH_EXPECTED === '1' || process.env.REGISTRY_AUTH_EXPECTED === 'true',
      docs: {
        worker_pull: 'The worker uses dockerode to pull the image string from Conductor (Service.docker_image) with no transform.',
        image_reference: 'Use a full OCI reference: [registry/]namespace/name[:tag|@digest]. For Harbor: harbor.example.com/aerekos/key_manager:1.0.0',
        credentials: 'Configure docker login (or creds store) on each worker host; do not pass registry passwords through this service.'
      }
    };
  }
}

module.exports = { RegistryConfigService };

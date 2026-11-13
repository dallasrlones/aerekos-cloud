import api from '../utils/api';

export const setupService = {
  async getGraph() {
    const res = await api.get('/api/setup/graph');
    return res.data;
  },

  async getServiceSetup(serviceName, projectId) {
    const res = await api.get(`/api/services/${serviceName}/setup`, {
      params: { project_id: projectId },
    });
    return res.data;
  },

  async getProjectSummary(projectId) {
    const res = await api.get(`/api/projects/${projectId}/setup-summary`);
    return res.data;
  },

  async enable(projectId, service, opts = {}) {
    const res = await api.post('/api/setup/enable', {
      project_id: projectId,
      service,
      with_dependencies: opts.withDependencies !== false,
      defaults: opts.defaults !== false,
    });
    return res.data;
  },

  async enablePack(projectId, pack) {
    const res = await api.post(`/api/setup/packs/${encodeURIComponent(pack)}`, { project_id: projectId });
    return res.data;
  },

  async listPacks() {
    const res = await api.get('/api/setup/packs');
    return res.data?.packs || [];
  },

  /** Dry-run (default) dependency enable plan via BFF. */
  async provisionDeps(projectId, service, opts = {}) {
    const res = await api.post('/api/services/provision-deps', {
      project_id: projectId,
      service,
      dry_run: opts.dryRun !== false,
    });
    return res.data?.plan || res.data;
  },
};

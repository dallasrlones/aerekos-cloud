import api from '../utils/api';

/**
 * Authentication (auth_manager) service — manages OIDC/OAuth identity provider
 * *metadata* (issuer, client_id, config). The real client_secret should live in
 * Secrets Manager, not here.
 *
 * Project-scoped. Conductor proxy: /api/services/auth_manager/api/* -> /api/v1/*
 */
const BASE = '/api/services/auth_manager/api/v1';

export const authManagerService = {
  // --- Control plane ---------------------------------------------------------
  async enable(workerId) {
    const response = await api.post('/api/services/auth_manager/enable', { worker_id: workerId });
    return response.data;
  },
  async disable() {
    const response = await api.post('/api/services/auth_manager/disable');
    return response.data;
  },
  async getStatus() {
    const response = await api.get('/api/services/auth_manager/status');
    return response.data;
  },

  // --- Identity providers ----------------------------------------------------
  async listProviders(projectId) {
    const response = await api.get(`${BASE}/providers`, { params: { project_id: projectId } });
    return response.data?.items || [];
  },

  async getProvider(projectId, id) {
    const response = await api.get(`${BASE}/providers/${id}`, { params: { project_id: projectId } });
    return response.data?.item;
  },

  /**
   * @param {object} data - { name, provider_type, issuer, client_id, config_json }
   */
  async createProvider(projectId, data) {
    const response = await api.post(`${BASE}/providers`, { ...data, project_id: projectId });
    return response.data?.item;
  },

  async updateProvider(projectId, id, data) {
    const response = await api.patch(`${BASE}/providers/${id}`, { ...data, project_id: projectId });
    return response.data?.item;
  },

  async deleteProvider(projectId, id) {
    await api.delete(`${BASE}/providers/${id}`, { params: { project_id: projectId } });
  },
};

export default authManagerService;

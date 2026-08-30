import api from '../utils/api';

/**
 * Project-scoped secrets (API tokens, webhook secrets, etc.).
 * Envelope-encrypted by secrets_manager using key_manager. Distinct from KMS "keys" in key_manager.
 */
export const secretsManagerService = {
  async enable(workerId) {
    const response = await api.post('/api/services/secrets_manager/enable', {
      worker_id: workerId
    });
    return response.data;
  },

  async disable() {
    const response = await api.post('/api/services/secrets_manager/disable');
    return response.data;
  },

  async getStatus() {
    const response = await api.get('/api/services/secrets_manager/status');
    return response.data;
  },

  async listSecrets(projectId) {
    const response = await api.get('/api/services/secrets_manager/api/v1/secrets', {
      params: { project_id: projectId }
    });
    return response.data;
  },

  async createSecret(projectId, { name, value, metadata }) {
    const response = await api.post('/api/services/secrets_manager/api/v1/secrets', {
      project_id: projectId,
      name,
      value,
      metadata: metadata != null ? metadata : undefined
    });
    return response.data;
  },

  async getSecret(projectId, id, { reveal = false } = {}) {
    const response = await api.get(
      `/api/services/secrets_manager/api/v1/secrets/${id}`,
      {
        params: { project_id: projectId, ...(reveal ? { reveal: '1' } : {}) }
      }
    );
    return response.data;
  },

  async updateSecret(projectId, id, { name, value, metadata } = {}) {
    const body = { project_id: projectId };
    if (name !== undefined) body.name = name;
    if (value !== undefined) body.value = value;
    if (metadata !== undefined) body.metadata = metadata;
    const response = await api.patch(
      `/api/services/secrets_manager/api/v1/secrets/${id}`,
      body
    );
    return response.data;
  },

  async deleteSecret(projectId, id) {
    const response = await api.delete(
      `/api/services/secrets_manager/api/v1/secrets/${id}`,
      { params: { project_id: projectId } }
    );
    return response.data;
  }
};

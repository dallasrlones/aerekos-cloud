import api from '../utils/api';

function errMsg(err, fallback) {
  return err.response?.data?.error?.message || err.message || fallback;
}

function withProject(params, projectId) {
  const next = { ...(params || {}) };
  if (projectId) next.project_id = projectId;
  return next;
}

export const dbManagerService = {
  async getDatabases(filters = {}) {
    const params = withProject({}, filters.project_id);
    if (filters.type) params.type = filters.type;
    if (filters.worker_id) params.worker_id = filters.worker_id;
    if (filters.status) params.status = filters.status;
    if (filters.environment) params.environment = filters.environment;
    const response = await api.get('/api/services/db_manager/api/databases', { params });
    return response.data;
  },

  async getDatabase(name, projectId) {
    const response = await api.get(`/api/services/db_manager/api/databases/${encodeURIComponent(name)}`, {
      params: withProject({}, projectId),
    });
    return response.data;
  },

  async createDatabase(databaseData) {
    const response = await api.post('/api/services/db_manager/api/databases', databaseData);
    return response.data;
  },

  async deleteDatabase(name, projectId) {
    await api.delete(`/api/services/db_manager/api/databases/${encodeURIComponent(name)}`, {
      params: withProject({}, projectId),
    });
  },

  async getConnectionString(name, projectId) {
    const response = await api.get(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/connection`,
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async startDatabase(name, projectId) {
    const response = await api.post(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/start`,
      { project_id: projectId },
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async stopDatabase(name, projectId) {
    const response = await api.post(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/stop`,
      { project_id: projectId },
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async restartDatabase(name, projectId) {
    const response = await api.post(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/restart`,
      { project_id: projectId },
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async createBackup(name, backupType = 'full', projectId) {
    const response = await api.post(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/backups`,
      { backup_type: backupType, project_id: projectId },
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async getDatabaseHealth(name, projectId) {
    const response = await api.get(
      `/api/services/db_manager/api/databases/${encodeURIComponent(name)}/health`,
      { params: withProject({}, projectId) },
    );
    return response.data;
  },

  async getHealth() {
    const response = await api.get('/api/services/db_manager/health');
    return response.data;
  },

  errMsg,
};

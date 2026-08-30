import api from '../utils/api';

/**
 * Compute Manager — project-scoped containers (ECS tasks).
 * Backend resource is still /tasks; UI says container.
 */
const BASE = '/api/services/compute_manager/api/v1';

export const computeManagerService = {
  async enable(workerId) {
    const response = await api.post('/api/services/compute_manager/enable', { worker_id: workerId });
    return response.data;
  },
  async disable() {
    const response = await api.post('/api/services/compute_manager/disable');
    return response.data;
  },
  async getStatus() {
    const response = await api.get('/api/services/compute_manager/status');
    return response.data;
  },
  async getMetrics() {
    try {
      const response = await api.get('/api/services/compute_manager/metrics');
      return response.data;
    } catch (e) {
      return null;
    }
  },
  async getInfo(projectId) {
    try {
      const response = await api.get(`${BASE}/info`, { params: { project_id: projectId } });
      return response.data;
    } catch (e) {
      return null;
    }
  },

  async listTasks(projectId, environment) {
    const response = await api.get(`${BASE}/tasks`, {
      params: { project_id: projectId, environment: environment || undefined },
    });
    return response.data?.tasks || [];
  },

  async adoptTask(projectId, data) {
    const response = await api.post(`${BASE}/tasks/adopt`, { ...data, project_id: projectId });
    return response.data?.task;
  },

  async getTask(projectId, id, refresh = false) {
    const params = { project_id: projectId };
    if (refresh) params.refresh = '1';
    const response = await api.get(`${BASE}/tasks/${id}`, { params });
    return response.data?.task;
  },

  async createTask(projectId, data) {
    const response = await api.post(`${BASE}/tasks`, { ...data, project_id: projectId });
    return response.data?.task;
  },

  async startTask(projectId, id) {
    const response = await api.post(`${BASE}/tasks/${id}/start`, { project_id: projectId });
    return response.data?.task;
  },

  async stopTask(projectId, id) {
    const response = await api.post(`${BASE}/tasks/${id}/stop`, { project_id: projectId });
    return response.data?.task;
  },

  async restartTask(projectId, id) {
    const response = await api.post(`${BASE}/tasks/${id}/restart`, { project_id: projectId });
    return response.data?.task;
  },

  async scaleTask(projectId, id, desired, extra = {}) {
    const response = await api.patch(`${BASE}/tasks/${id}/scale`, { project_id: projectId, desired, ...extra });
    return response.data?.task;
  },

  async getHealth(projectId, id) {
    const response = await api.get(`${BASE}/tasks/${id}/health`, { params: { project_id: projectId } });
    return response.data;
  },

  async getLogs(projectId, id, tail = 200) {
    const response = await api.get(`${BASE}/tasks/${id}/logs`, { params: { project_id: projectId, tail } });
    return response.data?.logs || '';
  },

  async queryLogs(projectId, { source, q, level, since, until, limit = 200 } = {}) {
    const response = await api.get('/api/services/logs_manager/api/v1/logs', {
      params: { project_id: projectId, source, q, level, since, until, limit },
    });
    return response.data?.logs || [];
  },

  async queryMetrics(projectId, { metric_name, task_id, limit = 60 } = {}) {
    const response = await api.get('/api/services/metrics_manager/api/v1/series', {
      params: { project_id: projectId, metric_name, task_id, limit },
    });
    return response.data?.items || [];
  },

  async listProjectImages(projectId) {
    const response = await api.get('/api/services/registry_manager/api/v1/images/project', {
      params: { project_id: projectId },
    });
    return response.data?.images || [];
  },

  async listHostnames(projectId) {
    const response = await api.get('/api/services/domain_manager/api/v1/dns/hostnames', {
      params: { project_id: projectId },
    });
    return response.data?.hostnames || response.data?.items || [];
  },

  async listPipelines(projectId) {
    const response = await api.get('/api/services/cicd_manager/api/v1/pipelines', {
      params: { project_id: projectId },
    });
    return response.data?.items || [];
  },

  async createPipeline(projectId, data) {
    const response = await api.post('/api/services/cicd_manager/api/v1/pipelines', {
      ...data,
      project_id: projectId,
    });
    return response.data?.item;
  },

  async runPipeline(projectId, id, body = {}) {
    const response = await api.post(`/api/services/cicd_manager/api/v1/pipelines/${id}/run`, {
      project_id: projectId,
      ...body,
    });
    return response.data;
  },

  async listRepos(projectId) {
    const response = await api.get('/api/services/git_manager/api/v1/repos', {
      params: { project_id: projectId },
    });
    return response.data?.repositories || response.data?.items || [];
  },

  async getServiceStatus(name) {
    const response = await api.get(`/api/services/${name}/status`);
    return response.data;
  },

  async enableService(name) {
    const response = await api.post(`/api/services/${name}/enable`);
    return response.data;
  },

  async deleteTask(projectId, id) {
    await api.delete(`${BASE}/tasks/${id}`, { params: { project_id: projectId } });
  },
};

export default computeManagerService;

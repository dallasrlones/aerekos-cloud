import api from '../utils/api';

const BASE = '/api/services/api_manager/api/v1';

export const apiManagerService = {
  async getStatus() {
    const response = await api.get('/api/services/api_manager/status');
    return response.data;
  },

  async enable() {
    const response = await api.post('/api/services/api_manager/enable');
    return response.data;
  },

  async disable() {
    const response = await api.post('/api/services/api_manager/disable');
    return response.data;
  },

  async listRoutes(projectId) {
    const response = await api.get(`${BASE}/endpoints`, { params: { project_id: projectId } });
    return response.data?.items || [];
  },

  async seedPresets(projectId) {
    const response = await api.post(`${BASE}/endpoints/seed-presets`, { project_id: projectId });
    return response.data;
  },

  async applyDataApi(projectId, doc) {
    const response = await api.post(`${BASE}/data-apis/apply`, { project_id: projectId, ...doc });
    return response.data;
  },

  async listDataApis(projectId) {
    const response = await api.get(`${BASE}/data-apis`, { params: { project_id: projectId } });
    return response.data?.items || [];
  },

  async scaleDataApi(projectId, name, desired) {
    const response = await api.post(`${BASE}/data-apis/${encodeURIComponent(name)}/scale`, { project_id: projectId, desired });
    return response.data;
  },

  async evaluateDataApiAutoscaling(projectId, name, body = {}) {
    const response = await api.post(`${BASE}/data-apis/${encodeURIComponent(name)}/autoscaling/evaluate`, { project_id: projectId, ...body });
    return response.data;
  },
};

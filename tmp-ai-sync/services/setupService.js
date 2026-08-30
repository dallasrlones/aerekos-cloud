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
};

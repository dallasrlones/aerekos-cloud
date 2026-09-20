import api from '../utils/api';

export const fleetService = {
  async getHealth(projectId) {
    const params = {};
    if (projectId) params.project_id = projectId;
    const res = await api.get('/api/fleet/health', { params });
    return res.data;
  },

  async getCapacity() {
    const res = await api.get('/api/fleet/capacity');
    return res.data?.hosts || [];
  },
};

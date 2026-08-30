import api from '../utils/api';

const BASE = '/api/services/backup_manager/api/v1';

export const backupService = {
  async run(projectId, { source, resource = 'default', vault = 'default' } = {}) {
    const res = await api.post(`${BASE}/jobs`, {
      project_id: projectId,
      source,
      resource,
      vault,
    });
    return res.data?.job || res.data;
  },
  async jobs(projectId) {
    const res = await api.get(`${BASE}/jobs`, { params: { project_id: projectId } });
    return res.data?.jobs || res.data?.items || [];
  },
  async get(projectId, jobId) {
    const res = await api.get(`${BASE}/jobs/${jobId}`, { params: { project_id: projectId } });
    return res.data?.job || res.data;
  },
  async restore(projectId, jobId, dest) {
    const res = await api.post(`${BASE}/jobs/${jobId}/restore`, { project_id: projectId, dest });
    return res.data;
  },
};

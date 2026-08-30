import api from '../utils/api';

/**
 * Project stack JSON (code-as-infra). Click-ops record here so apply recreates resources.
 */
export const stackService = {
  async current(projectId) {
    const res = await api.get(`/api/projects/${projectId}/stack`);
    return res.data;
  },

  async put(projectId, stack) {
    const res = await api.put(`/api/projects/${projectId}/stack`, stack);
    return res.data;
  },

  async record(projectId, body) {
    if (!projectId || !body) return null;
    try {
      const res = await api.post(`/api/projects/${projectId}/stack/record`, body);
      return res.data;
    } catch {
      return null;
    }
  },

  async unrecord(projectId, body) {
    if (!projectId || !body) return null;
    try {
      const res = await api.delete(`/api/projects/${projectId}/stack/record`, { data: body });
      return res.data;
    } catch {
      return null;
    }
  },

  async apply(projectId) {
    const res = await api.post(`/api/projects/${projectId}/stack/apply`, {});
    return res.data;
  },

  async sync(projectId) {
    const res = await api.post(`/api/projects/${projectId}/stack/sync`, {});
    return res.data;
  },

  async diff(projectId) {
    const res = await api.post(`/api/projects/${projectId}/stack/diff`, {});
    return res.data;
  },

  async rollback(projectId) {
    const res = await api.post(`/api/projects/${projectId}/stack/rollback`, {});
    return res.data;
  },
};

export default stackService;

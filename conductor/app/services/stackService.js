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

  // ---- infra-as-code (task 5): the infra file + device-aware up/down ----

  /** Export the project's infra-as-code file (committed to its infra repo). */
  async exportInfra(projectId, { commit } = {}) {
    const res = await api.get(`/api/projects/${projectId}/infra/export${commit === false ? '?commit=0' : ''}`);
    return res.data;
  },

  /** System-tier infra file (system/infra.json). */
  async systemInfra() {
    const res = await api.get('/api/system/infra/export');
    return res.data;
  },

  /**
   * Device-aware apply: enable the services on their pinned devices
   * ("auto" → most free disk), bake devices back into the stack, provision
   * resources, commit infra.json. Body: { file?, any_device? }.
   */
  async applyInfra(projectId, body = {}) {
    const res = await api.post(`/api/projects/${projectId}/infra/apply`, body);
    return res.data;
  },

  /** Down: soft (detach services) or { hard: true } (also delete resources). */
  async downInfra(projectId, body = {}) {
    const res = await api.post(`/api/projects/${projectId}/infra/down`, body);
    return res.data;
  },
};

export default stackService;

import api from '../utils/api';

/**
 * Compute Manager service — container hosting (ECS-style "tasks").
 *
 * Tasks are project-scoped, so every call passes `project_id` explicitly (the
 * conductor's generic proxy requires it in query/body/header). Creating a task
 * also starts the container; there is no separate "start" — only stop + delete.
 *
 * Conductor proxy: /api/services/compute_manager/api/* -> worker /api/v1/*
 */
const BASE = '/api/services/compute_manager/api/v1';

export const computeManagerService = {
  // --- Service control plane -------------------------------------------------
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

  /** Service info (engine, version) — null if unreachable. */
  async getInfo(projectId) {
    try {
      const response = await api.get(`${BASE}/info`, { params: { project_id: projectId } });
      return response.data;
    } catch (e) {
      return null;
    }
  },

  // --- Tasks (containers) ----------------------------------------------------
  /** List tasks for a project. */
  async listTasks(projectId) {
    const response = await api.get(`${BASE}/tasks`, { params: { project_id: projectId } });
    return response.data?.tasks || [];
  },

  /** Get one task; pass refresh=true to sync live status from docker inspect. */
  async getTask(projectId, id, refresh = false) {
    const params = { project_id: projectId };
    if (refresh) params.refresh = '1';
    const response = await api.get(`${BASE}/tasks/${id}`, { params });
    return response.data?.task;
  },

  /**
   * Create and start a task (container).
   * @param {string} projectId
   * @param {object} data - { name, image, command?: string[], env?: object,
   *                          port_bindings?: object, run_mode?: 'service'|'oneshot' }
   */
  async createTask(projectId, data) {
    const response = await api.post(`${BASE}/tasks`, { ...data, project_id: projectId });
    return response.data?.task;
  },

  /** Stop a running task's container. */
  async stopTask(projectId, id) {
    const response = await api.post(`${BASE}/tasks/${id}/stop`, { project_id: projectId });
    return response.data?.task;
  },

  /** Delete a task (removes container + record). */
  async deleteTask(projectId, id) {
    await api.delete(`${BASE}/tasks/${id}`, { params: { project_id: projectId } });
  },
};

export default computeManagerService;

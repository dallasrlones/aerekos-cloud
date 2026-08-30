import api from '../utils/api';

/**
 * Generic manager service client.
 *
 * Every manager seeded in the conductor exposes the same control-plane surface
 * through the conductor proxy:
 *   GET  /api/services                      -> list all services + enabled flag
 *   GET  /api/services/:name/status         -> deploy/health status
 *   POST /api/services/:name/enable         -> deploy to a worker
 *   POST /api/services/:name/disable        -> stop + remove
 *   GET  /api/services/:name/health         -> upstream /health passthrough
 *   GET  /api/services/:name/metrics        -> upstream /metrics (text or json)
 *
 * This lets the ServicesConsole + generic ManagerConsole drive ANY manager
 * without bespoke code, mirroring how an AWS service page works the same way
 * regardless of which service you opened.
 */
export const managerService = {
  /** List every registered service with its enabled flag. */
  async listServices() {
    const response = await api.get('/api/services');
    return response.data?.services || [];
  },

  /** Deploy/health status for a single service. */
  async getStatus(name) {
    const response = await api.get(`/api/services/${name}/status`);
    return response.data;
  },

  /** Enable (deploy) a service, optionally pinned to a worker. */
  async enable(name, workerId) {
    const response = await api.post(`/api/services/${name}/enable`, {
      worker_id: workerId,
    });
    return response.data;
  },

  /** Disable (stop + remove) a service. */
  async disable(name) {
    const response = await api.post(`/api/services/${name}/disable`);
    return response.data;
  },

  /** Upstream health passthrough; returns null if unreachable. */
  async getHealth(name) {
    try {
      const response = await api.get(`/api/services/${name}/health`);
      return response.data;
    } catch (err) {
      return null;
    }
  },

  /** Upstream metrics passthrough (Prometheus text or JSON); null if unreachable. */
  async getMetrics(name) {
    try {
      const response = await api.get(`/api/services/${name}/metrics`);
      return response.data;
    } catch (err) {
      return null;
    }
  },

  /** Deployed instances (optionally scoped to a project). */
  async listInstances(name, projectId) {
    const params = {};
    if (projectId) params.project_id = projectId;
    const response = await api.get(`/api/services/${name}/instances`, { params });
    return response.data?.instances || [];
  },
};

export default managerService;

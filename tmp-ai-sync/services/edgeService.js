import api from '../utils/api';

const BASE = '/api/services/tunnel_manager/api/v1';
const DNS_BASE = '/api/services/domain_manager/api/v1';

export const edgeService = {
  async probeCloudflare(projectId) {
    const res = await api.get('/api/edge/cloudflare/probe', {
      params: { project_id: projectId },
    });
    return res.data?.probe;
  },

  async listTunnels(projectId) {
    const res = await api.get(`${BASE}/tunnels`, {
      params: { project_id: projectId },
    });
    return res.data?.tunnels || [];
  },

  async createTunnel(projectId, name) {
    const res = await api.post(`${BASE}/tunnels`, {
      project_id: projectId,
      name,
    });
    return res.data;
  },

  async importFromCloudflare(projectId) {
    const res = await api.post(`${BASE}/tunnels/import-from-cloudflare`, {
      project_id: projectId,
    });
    return res.data;
  },

  async reconcileTunnels(projectId) {
    const res = await api.post(`${BASE}/tunnels/reconcile`, {
      project_id: projectId,
    });
    return res.data;
  },

  async getIngress(projectId, tunnelId) {
    const res = await api.get(`${BASE}/tunnels/${tunnelId}/ingress`, {
      params: { project_id: projectId },
    });
    return res.data;
  },

  async setIngress(projectId, tunnelId, ingress) {
    const res = await api.put(`${BASE}/tunnels/${tunnelId}/ingress`, {
      project_id: projectId,
      ingress,
    });
    return res.data;
  },

  async deleteTunnel(projectId, tunnelId) {
    const res = await api.delete(`${BASE}/tunnels/${tunnelId}`, {
      params: { project_id: projectId },
    });
    return res.data;
  },

  async listZones(projectId) {
    const res = await api.get(`${DNS_BASE}/dns/zones`, {
      params: { project_id: projectId },
    });
    return res.data?.zones || [];
  },
};

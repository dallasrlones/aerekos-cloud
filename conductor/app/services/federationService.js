import apiClient from '../utils/api';

export const federationService = {
  async getPeerCard() {
    const response = await apiClient.get('/api/federation/peer');
    return response.data;
  },

  async listPeers() {
    const response = await apiClient.get('/api/federation/peers');
    return response.data;
  },

  async registerPeer(peer) {
    const response = await apiClient.post('/api/federation/peers', peer || {});
    return response.data;
  },

  async mintGrant(projectId, body) {
    const response = await apiClient.post(`/api/projects/${projectId}/federation/grants`, body || {});
    return response.data;
  },

  async listGrants(projectId) {
    const response = await apiClient.get(`/api/projects/${projectId}/federation/grants`);
    return response.data;
  },

  async attach(token, label) {
    const response = await apiClient.post('/api/federation/attach', { token, label });
    return response.data;
  },

  async listAttaches() {
    const response = await apiClient.get('/api/federation/attaches');
    return response.data;
  },

  async detach(attachId) {
    const response = await apiClient.delete(`/api/federation/attaches/${attachId}`);
    return response.data;
  },

  async attachStatus(attachId) {
    const response = await apiClient.get(`/api/federation/attaches/${attachId}/status`);
    return response.data;
  },

  async proxyProject(attachId) {
    const response = await apiClient.get(`/api/federation/attaches/${attachId}/project`);
    return response.data;
  },
};

export default federationService;

import api from '../utils/api';

/**
 * Device Service - API calls for worker/device management
 */
export const deviceService = {
  /**
   * Get registration token
   * @returns {Promise<string>} Registration token
   */
  async getRegistrationToken() {
      const response = await api.get('/api/token');
    return response.data.token;
  },

  /**
   * Regenerate registration token
   * @returns {Promise<string>} New registration token
   */
  async regenerateToken() {
      const response = await api.post('/api/token/regenerate');
    return response.data.token;
  },

  /**
   * Get all devices/workers
   * @returns {Promise<Array>} Array of devices
   */
  async getDevices() {
      const response = await api.get('/api/workers');
    return response.data.workers || [];
  },

  /**
   * Get device by ID
   * @param {string} deviceId - Device ID
   * @returns {Promise<object>} Device details
   */
  async getDevice(deviceId) {
      const response = await api.get(`/api/workers/${deviceId}`);
    return response.data.worker;
  },

  /**
   * Get the conductor's own deployed version (git short SHA). Used to flag
   * devices running outdated code.
   * @returns {Promise<string|null>} Conductor version
   */
  async getConductorVersion() {
    try {
      const response = await api.get('/api/version');
      return response.data?.version || null;
    } catch (_e) {
      return null;
    }
  },

  /**
   * Get the latest release published to the conductor's release server.
   * @returns {Promise<object|null>} { version, notes, created_at, ... }
   */
  async getLatestRelease() {
    try {
      const response = await api.get('/api/releases/latest');
      return response.data?.release || null;
    } catch (_e) {
      return null;
    }
  },

  /**
   * Ask a device to pull the latest release from the conductor and redeploy.
   * @param {string} deviceId - Device ID
   * @returns {Promise<object>} { ok, target_version, ... }
   */
  async requestUpdate(deviceId) {
    const response = await api.post(`/api/workers/${deviceId}/update`);
    return response.data;
  },

  /**
   * Live host OS/Docker patch check (does not apply updates).
   * @param {string} deviceId
   * @returns {Promise<object>}
   */
  async checkHost(deviceId) {
    const response = await api.post(`/api/workers/${deviceId}/host/check`);
    return response.data;
  },

  /**
   * Apply host OS or Docker package updates on the device.
   * @param {string} deviceId
   * @param {'os'|'docker'} target
   * @returns {Promise<object>}
   */
  async updateHost(deviceId, target) {
    const response = await api.post(`/api/workers/${deviceId}/host/update`, { target });
    return response.data;
  },

  async listVpcs() {
    const response = await api.get('/api/workers/vpcs');
    return response.data.vpcs || [];
  },

  async moveToVpc(deviceId, vpcId) {
    const response = await api.patch(`/api/workers/${deviceId}/vpc`, { vpc_id: vpcId });
    return response.data.worker;
  },

  async getNetwork(deviceId) {
    const response = await api.get(`/api/workers/${deviceId}/network`);
    return response.data;
  },

  async joinMesh(deviceId, projectId) {
    const response = await api.post(`/api/workers/${deviceId}/mesh/join`, { project_id: projectId });
    return response.data;
  },
};

/**
 * Human label for one host probe part (OS or Docker).
 * @param {object|null} part
 * @returns {string|null}
 */
export function deviceLabel(device) {
  if (!device) return '';
  return device.display_name || device.hostname || device.id || '';
}

export function hostPartLabel(part) {
  if (!part) return null;
  if (part.supported === false) return 'unsupported';
  const n = Number(part.updates_available);
  if (!Number.isFinite(n) || n <= 0) return 'Up to date';
  return n === 1 ? '1 update' : `${n} updates`;
}


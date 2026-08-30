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
  }
};


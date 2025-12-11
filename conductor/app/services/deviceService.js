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
  }
};


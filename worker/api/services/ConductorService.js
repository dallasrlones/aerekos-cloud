const axios = require('axios');

/**
 * Conductor Service - Client for communicating with conductor API
 */
class ConductorService {
  constructor(conductorUrl) {
    this.conductorUrl = conductorUrl;
    this.workerId = null;
  }

  /**
   * Register worker with conductor
   * @param {string} token - Registration token
   * @param {string} hostname - Worker hostname (actual device hostname)
   * @param {string} ipAddress - Worker IP address (actual device IP)
   * @param {object} resources - Initial resource information
   * @returns {Promise<object>} Registered worker info
   * @throws {Error} If registration fails
   */
  async registerWorker(token, hostname, ipAddress, resources) {
    try {
      const response = await axios.post(`${this.conductorUrl}/api/workers/register`, {
        token,
        hostname,
        ip_address: ipAddress,
        resources
      });

      this.workerId = response.data.worker.id;
      return response.data.worker;
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error?.message || 'Registration failed');
      }
      throw new Error(`Failed to connect to conductor: ${error.message}`);
    }
  }

  /**
   * Send heartbeat to conductor
   * @returns {Promise<object>} Updated worker info
   * @throws {Error} If heartbeat fails
   */
  async sendHeartbeat() {
    if (!this.workerId) {
      throw new Error('Worker not registered');
    }

    try {
      const response = await axios.post(
        `${this.conductorUrl}/api/workers/${this.workerId}/heartbeat`
      );
      return response.data.worker;
    } catch (error) {
      if (error.response) {
        // If worker not found, need to re-register
        if (error.response.status === 404) {
          this.workerId = null;
          throw new Error('Worker not found - re-registration required');
        }
        throw new Error(error.response.data.error?.message || 'Heartbeat failed');
      }
      throw new Error(`Failed to connect to conductor: ${error.message}`);
    }
  }

  /**
   * Update worker resources
   * @param {object} resources - Resource information
   * @returns {Promise<object>} Updated worker info
   * @throws {Error} If update fails
   */
  async updateResources(resources) {
    if (!this.workerId) {
      throw new Error('Worker not registered');
    }

    try {
      const response = await axios.put(
        `${this.conductorUrl}/api/workers/${this.workerId}/resources`,
        { resources }
      );
      return response.data.worker;
    } catch (error) {
      if (error.response) {
        // If worker not found, need to re-register
        if (error.response.status === 404) {
          this.workerId = null;
          throw new Error('Worker not found - re-registration required');
        }
        throw new Error(error.response.data.error?.message || 'Resource update failed');
      }
      throw new Error(`Failed to connect to conductor: ${error.message}`);
    }
  }

  /**
   * Get deployment instructions from conductor
   * @returns {Promise<Array>} Deployment instructions
   * @throws {Error} If request fails
   */
  async getDeploymentInstructions() {
    if (!this.workerId) {
      throw new Error('Worker not registered');
    }

    try {
      // TODO: Implement when conductor has deployment endpoint
      // For now, return empty array
      return [];
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error?.message || 'Failed to get deployment instructions');
      }
      throw new Error(`Failed to connect to conductor: ${error.message}`);
    }
  }

  /**
   * Report service status to conductor
   * @param {string} serviceName - Service name
   * @param {string} status - Service status
   * @returns {Promise<void>}
   * @throws {Error} If report fails
   */
  async reportServiceStatus(serviceName, status) {
    if (!this.workerId) {
      throw new Error('Worker not registered');
    }

    try {
      // TODO: Implement when conductor has service status endpoint
      // For now, just log
      console.log(`Service ${serviceName} status: ${status}`);
    } catch (error) {
      if (error.response) {
        throw new Error(error.response.data.error?.message || 'Failed to report service status');
      }
      throw new Error(`Failed to connect to conductor: ${error.message}`);
    }
  }

  /**
   * Get worker ID
   * @returns {string|null} Worker ID or null if not registered
   */
  getWorkerId() {
    return this.workerId;
  }

  /**
   * Set worker ID (for re-registration scenarios)
   * @param {string} workerId - Worker ID
   */
  setWorkerId(workerId) {
    this.workerId = workerId;
  }
}

module.exports = ConductorService;


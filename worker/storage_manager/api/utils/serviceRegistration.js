const axios = require('axios');
const { detectAvailablePort } = require('./portDetection');
const logger = require('./logger');

/**
 * Register service with conductor
 * @returns {Promise<object>} Registration response
 */
async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceName = process.env.SERVICE_NAME || 'storage_manager';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  
  // Auto-detect available port
  const basePort = parseInt(process.env.PORT || '3003', 10);
  const port = await detectAvailablePort(basePort);
  
  try {
    logger.info(`[${serviceName}] Registering with conductor at ${conductorUrl}...`);
    
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name: serviceName,
      version: serviceVersion,
      port: port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ['object_storage', 's3_compatible', 'encryption', 'chunked_uploads', 'signed_urls'],
      metadata: {
        description: 'S3-compatible object storage service',
        supports: ['projects', 'buckets', 'files', 'multipart_uploads', 'signed_urls'],
        max_file_size: process.env.MAX_FILE_SIZE || '10737418240'
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    logger.info(`[${serviceName}] Successfully registered: ${response.data.service_id}`);
    
    if (response.data.service_token) {
      logger.info(`[${serviceName}] Service token: ${response.data.service_token.substring(0, 20)}...`);
      // Store service token for future requests
      process.env.SERVICE_TOKEN = response.data.service_token;
    }
    
    // Update PORT environment variable with detected port
    process.env.PORT = port.toString();
    
    return response.data;
  } catch (error) {
    logger.error(`[${serviceName}] Registration failed:`, error.message);
    if (error.response) {
      logger.error(`[${serviceName}] Response:`, error.response.data);
    }
    
    // If registration endpoint doesn't exist yet, log warning but don't fail
    if (error.response?.status === 404 || error.code === 'ECONNREFUSED') {
      logger.warn(`[${serviceName}] Conductor registration endpoint not available. Service will continue without registration.`);
      // Set a default port
      process.env.PORT = port.toString();
      return { service_id: 'local', port };
    }
    
    throw error;
  }
}

module.exports = { registerWithConductor };

const axios = require('axios');
const detectAvailablePort = require('./portDetection');

async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceName = process.env.SERVICE_NAME || 'key_manager';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  
  // Auto-detect available port
  const basePort = parseInt(process.env.PORT || '3002', 10);
  const port = await detectAvailablePort(basePort);
  
  try {
    console.log(`[${serviceName}] Registering with conductor at ${conductorUrl}...`);
    
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name: serviceName,
      version: serviceVersion,
      port: port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ['key_management', 'encryption', 'key_rotation'],
      metadata: {
        description: 'Key Management Service (KMS)',
        supports: ['symmetric', 'asymmetric', 'master'],
        algorithms: ['AES-256-GCM', 'AES-128-GCM', 'RSA-4096', 'RSA-2048']
      }
    }, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });
    
    console.log(`[${serviceName}] Successfully registered: ${response.data.service_id}`);
    console.log(`[${serviceName}] Service token: ${response.data.service_token?.substring(0, 20)}...`);
    
    // Store service token for future requests
    process.env.SERVICE_TOKEN = response.data.service_token;
    
    return response.data;
  } catch (error) {
    console.error(`[${serviceName}] Registration failed:`, error.message);
    if (error.response) {
      console.error(`[${serviceName}] Response:`, error.response.data);
      console.error(`[${serviceName}] Status:`, error.response.status);
    }
    
    // If service registration endpoint doesn't exist yet, log warning but continue
    if (error.response?.status === 404) {
      console.warn(`[${serviceName}] Service registration endpoint not found. Service will continue but may not be discoverable.`);
      console.warn(`[${serviceName}] NOTE: Conductor needs to implement POST /api/services/register endpoint`);
      return null;
    }
    
    throw error;
  }
}

module.exports = { registerWithConductor };

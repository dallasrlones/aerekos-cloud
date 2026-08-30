const axios = require('axios');
const detectAvailablePort = require('./portDetection');

async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceName = process.env.SERVICE_NAME || 'db_manager';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  
  // Auto-detect available port
  const basePort = parseInt(process.env.PORT || '3004', 10);
  const port = await detectAvailablePort(basePort);
  
  try {
    console.log(`[${serviceName}] Registering with conductor at ${conductorUrl}...`);
    
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name: serviceName,
      version: serviceVersion,
      port: port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ['database_management', 'database_creation', 'connection_management', 'backup_management'],
      metadata: {
        description: 'Database Manager Service',
        supports: ['postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis'],
        features: ['encryption', 'backup', 'connection_pooling']
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

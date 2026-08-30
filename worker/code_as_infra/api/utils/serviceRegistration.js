const axios = require('axios');
const detectAvailablePort = require('./portDetection');
async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const name = process.env.SERVICE_NAME || 'code_as_infra';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  const basePort = parseInt(process.env.PORT || '3120', 10);
  const port = await detectAvailablePort(basePort);
  try {
    console.log(`[${name}] Registering with conductor at ${conductorUrl}...`);
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name,
      version: serviceVersion,
      port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ["iac","declarative"],
      metadata: { description: 'code_as_infra service' }
    }, { headers: { 'Content-Type': 'application/json' }, timeout: 10000 });
    console.log(`[${name}] Registered: ${response.data.service_id}`);
    if (response.data.service_token) process.env.SERVICE_TOKEN = response.data.service_token;
    return response.data;
  } catch (error) {
    console.error(`[${name}] Registration failed:`, error.message);
    if (error.response?.status === 404) {
      console.warn(`[${name}] POST /api/services/register not found — continuing without registry.`);
      return null;
    }
    throw error;
  }
}
module.exports = { registerWithConductor };

const axios = require('axios');
async function registerWithConductor(listenPort) {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const name = process.env.SERVICE_NAME || 'auth_manager';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  // Register the port we are actually listening on — never re-detect a free port
  // after listen (that caused wrong-port registration / proxy quirks).
  const port = parseInt(listenPort != null ? listenPort : (process.env.PORT || '3116'), 10);
  try {
    console.log(`[${name}] Registering with conductor at ${conductorUrl}...`);
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name,
      version: serviceVersion,
      port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ["oauth","sso_hooks","sessions"],
      metadata: { description: 'auth_manager service' }
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

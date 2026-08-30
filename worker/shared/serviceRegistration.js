'use strict';

const path = require('path');
const net = require('net');

function loadAxios() {
  try {
    return require('axios');
  } catch (err) {
    return require(path.join(process.cwd(), 'node_modules', 'axios'));
  }
}

function detectAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') detectAvailablePort(startPort + 1).then(resolve).catch(reject);
      else reject(err);
    });
  });
}

function makeRegister({ serviceName, defaultPort, capabilities = [] }) {
  return async function registerWithConductor() {
    const conductorUrl = process.env.CONDUCTOR_URL;
    const name = process.env.SERVICE_NAME || serviceName;
    const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
    const basePort = parseInt(process.env.PORT || String(defaultPort), 10);
    const port = await detectAvailablePort(basePort);
    try {
      console.log(`[${name}] Registering with conductor at ${conductorUrl}...`);
      const axios = loadAxios();
      const response = await axios.post(
        `${conductorUrl}/api/services/register`,
        {
          name,
          version: serviceVersion,
          port,
          health_endpoint: '/health',
          ready_endpoint: '/ready',
          capabilities,
          metadata: { description: `${name} service` },
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
      );
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
  };
}

module.exports = { makeRegister, detectAvailablePort };

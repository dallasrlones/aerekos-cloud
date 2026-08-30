const net = require('net');

/**
 * Auto-detect available port starting from startPort
 * @param {number} startPort - Starting port number
 * @returns {Promise<number>} Available port number
 */
async function detectAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use, try next port
        detectAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = { detectAvailablePort };

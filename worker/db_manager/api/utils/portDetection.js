const net = require('net');

async function detectAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => {
        console.log(`[db_manager] Detected available port: ${port}`);
        resolve(port);
      });
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use, try next port
        console.log(`[db_manager] Port ${startPort} in use, trying ${startPort + 1}...`);
        detectAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}

module.exports = detectAvailablePort;

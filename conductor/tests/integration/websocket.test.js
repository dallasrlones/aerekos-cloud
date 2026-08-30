const http = require('http');
const { Server } = require('socket.io');
const { io: Client } = require('socket.io-client');
const WorkerSocketService = require('../../api/services/WorkerSocketService');
const WorkerService = require('../../api/services/WorkerService');
const TokenService = require('../../api/services/TokenService');
const TokenRepository = require('../../api/repos/TokenRepository');
const { setupTestDatabase, cleanupTestData, createTestWorker } = require('../helpers/dbHelper');

// Ensure app doesn't try to seed users in test mode
process.env.NODE_ENV = 'test';

describe('WorkerSocketService Integration Tests', () => {
  let httpServer;
  let socketService;
  let registrationToken;
  let testWorker;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create registration token using TokenService singleton
    registrationToken = await TokenService.generateRegistrationToken();
    
    // Create test worker
    testWorker = await createTestWorker();
  });

  afterAll(async () => {
    await cleanupTestData();
    if (httpServer) {
      await new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  beforeEach(() => {
    // Create HTTP server for Socket.IO
    httpServer = http.createServer();
    socketService = WorkerSocketService;
    
    // Reset socket service state
    socketService.io = null;
    socketService.workerSockets.clear();
    socketService.socketWorkers.clear();
    socketService.workerLastHeartbeat.clear();
    
    socketService.initialize(httpServer);
    
    // Start server
    return new Promise((resolve) => {
      httpServer.listen(0, () => {
        resolve();
      });
    });
  });

  afterEach(() => {
    // Clean up sockets
    if (socketService && socketService.io) {
      socketService.io.close();
      socketService.io = null;
    }
    if (httpServer) {
      return new Promise((resolve) => {
        httpServer.close(() => resolve());
      });
    }
  });

  describe('Worker Registration via WebSocket', () => {
    test('should register worker via WebSocket', (done) => {
      const port = httpServer.address().port;
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling']
      });

      client.on('connect', () => {
        client.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 }
        });
      });

      client.on('worker:registered', (data) => {
        expect(data).toHaveProperty('workerId');
        expect(data).toHaveProperty('hostname', 'test-worker');
        expect(data).toHaveProperty('ip_address', '127.0.0.1');
        expect(data).toHaveProperty('status', 'online');
        client.disconnect();
        done();
      });

      client.on('error', (error) => {
        client.disconnect();
        done(error);
      });
    });

    test('should register worker with existing worker ID', (done) => {
      const port = httpServer.address().port;
      const client = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling']
      });

      client.on('connect', () => {
        client.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker-existing',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 },
          worker_id: testWorker.id // existing worker ID
        });
      });

      client.on('worker:registered', (data) => {
        expect(data).toHaveProperty('workerId', testWorker.id);
        expect(data).toHaveProperty('hostname');
        client.disconnect();
        done();
      });

      client.on('error', (error) => {
        client.disconnect();
        done(error);
      });
    });
  });

  describe('Worker Live Updates', () => {
    jest.setTimeout(25000);

    test('should emit worker:live:update event on worker:ping with resources', (done) => {
      const port = httpServer.address().port;
      const workerClient = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      const frontendClient = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      let workerId;

      workerClient.on('connect', () => {
        workerClient.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker-live',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 }
        });
      });

      workerClient.on('worker:registered', (data) => {
        workerId = data.workerId;
        frontendClient.emit('worker:subscribe', { workerId });

        setTimeout(() => {
          workerClient.emit('worker:ping', {
            timestamp: new Date().toISOString(),
            resources: {
              cpu_cores: 8,
              ram_gb: 16,
              disk_gb: 500,
              network_mbps: 1000,
              cpu: { usage_percent: 45.5 },
              ram: { used_gb: 8.5, total_gb: 16, usage_percent: 53.1 },
              disk: { used_gb: 250, total_gb: 500, usage_percent: 50.0 },
              network: { rx_bytes_per_sec: 1024000, tx_bytes_per_sec: 2048000 }
            }
          });
        }, 400);
      });

      frontendClient.on('connect', () => {
        setTimeout(() => workerClient.connect(), 80);
      });

      const failTimer = setTimeout(() => {
        workerClient.disconnect();
        frontendClient.disconnect();
        done(new Error('Test timeout - worker:live:update event not received'));
      }, 20000);

      frontendClient.on('worker:live:update', (data) => {
        expect(data).toHaveProperty('workerId', workerId);
        expect(data).toHaveProperty('resources');
        expect(data.resources).toHaveProperty('cpu');
        expect(data.resources).toHaveProperty('ram');
        expect(data.resources).toHaveProperty('disk');
        expect(data.resources).toHaveProperty('network');
        expect(data.resources.cpu).toHaveProperty('usage_percent', 45.5);
        expect(data.resources.ram).toHaveProperty('used_gb', 8.5);
        expect(data.resources.disk).toHaveProperty('used_gb', 250);
        expect(data).toHaveProperty('timestamp');

        clearTimeout(failTimer);
        workerClient.disconnect();
        frontendClient.disconnect();
        done();
      });

      frontendClient.on('error', (error) => {
        clearTimeout(failTimer);
        workerClient.disconnect();
        frontendClient.disconnect();
        done(error);
      });

      frontendClient.connect();
    });

    test('should emit worker:resources:updated to all frontend clients', (done) => {
      const port = httpServer.address().port;
      const workerClient = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      const frontendClient1 = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      const frontendClient2 = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      let workerId;
      let updateCount = 0;

      workerClient.on('connect', () => {
        workerClient.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker-resources',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4, ram_gb: 8 }
        });
      });

      workerClient.on('worker:registered', (data) => {
        workerId = data.workerId;

        setTimeout(() => {
          workerClient.emit('worker:ping', {
            timestamp: new Date().toISOString(),
            resources: {
              cpu_cores: 8,
              ram_gb: 16,
              disk_gb: 500,
              network_mbps: 1000,
              cpu: { usage_percent: 50 },
              ram: { used_gb: 10, total_gb: 16 },
              disk: { used_gb: 300, total_gb: 500 },
              network: { rx_bytes_per_sec: 0, tx_bytes_per_sec: 0 }
            }
          });
        }, 400);
      });

      const failTimer = setTimeout(() => {
        workerClient.disconnect();
        frontendClient1.disconnect();
        frontendClient2.disconnect();
        done(new Error('Test timeout'));
      }, 20000);

      const checkDone = () => {
        updateCount++;
        if (updateCount === 2) {
          clearTimeout(failTimer);
          workerClient.disconnect();
          frontendClient1.disconnect();
          frontendClient2.disconnect();
          done();
        }
      };

      let frontendsJoined = 0;
      const maybeConnectWorker = () => {
        frontendsJoined++;
        if (frontendsJoined === 2) {
          workerClient.connect();
        }
      };

      frontendClient1.on('worker:resources:updated', (data) => {
        expect(data).toHaveProperty('workerId', workerId);
        expect(data).toHaveProperty('resources');
        checkDone();
      });

      frontendClient2.on('worker:resources:updated', (data) => {
        expect(data).toHaveProperty('workerId', workerId);
        expect(data).toHaveProperty('resources');
        checkDone();
      });

      frontendClient1.on('connect', () => {
        frontendClient1.emit('join', { room: 'frontend' });
        setTimeout(maybeConnectWorker, 80);
      });

      frontendClient2.on('connect', () => {
        frontendClient2.emit('join', { room: 'frontend' });
        setTimeout(maybeConnectWorker, 80);
      });

      frontendClient1.connect();
      frontendClient2.connect();
    });

    test('should handle worker:resources event', (done) => {
      const port = httpServer.address().port;
      const workerClient = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      const frontendClient = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      let workerId;

      workerClient.on('connect', () => {
        workerClient.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker-resources-event',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4 }
        });
      });

      workerClient.on('worker:registered', (data) => {
        workerId = data.workerId;

        setTimeout(() => {
          workerClient.emit('worker:resources', {
            resources: {
              cpu_cores: 8,
              ram_gb: 16,
              disk_gb: 500,
              network_mbps: 2000
            }
          });
        }, 400);
      });

      const failTimer = setTimeout(() => {
        workerClient.disconnect();
        frontendClient.disconnect();
        done(new Error('Test timeout'));
      }, 20000);

      frontendClient.on('connect', () => {
        frontendClient.emit('join', { room: 'frontend' });
        setTimeout(() => workerClient.connect(), 80);
      });

      frontendClient.on('worker:resources:updated', (data) => {
        expect(data).toHaveProperty('workerId', workerId);
        expect(data).toHaveProperty('resources');
        expect(data.resources.cpu_cores).toBe(8);

        clearTimeout(failTimer);
        workerClient.disconnect();
        frontendClient.disconnect();
        done();
      });

      frontendClient.connect();
    });

    test('should handle worker disconnect and mark offline', (done) => {
      const port = httpServer.address().port;
      const workerClient = Client(`http://localhost:${port}`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      const frontendClient = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling'],
        autoConnect: false
      });

      let workerId;

      workerClient.on('connect', () => {
        workerClient.emit('worker:register', {
          token: registrationToken,
          hostname: 'test-worker-disconnect',
          ip_address: '127.0.0.1',
          resources: { cpu_cores: 4 }
        });
      });

      workerClient.on('worker:registered', (data) => {
        workerId = data.workerId;

        setTimeout(() => {
          workerClient.disconnect();
        }, 150);
      });

      const failTimer = setTimeout(() => {
        workerClient.disconnect();
        frontendClient.disconnect();
        done(new Error('Test timeout'));
      }, 20000);

      frontendClient.on('connect', () => {
        frontendClient.emit('join', { room: 'frontend' });
        setTimeout(() => workerClient.connect(), 80);
      });

      frontendClient.on('worker:offline', (data) => {
        expect(data).toHaveProperty('workerId', workerId);
        expect(data).toHaveProperty('timestamp');

        clearTimeout(failTimer);
        frontendClient.disconnect();
        done();
      });

      frontendClient.connect();
    });

    test('should handle worker:subscribe and worker:unsubscribe', (done) => {
      const port = httpServer.address().port;
      const frontendClient = Client(`http://localhost:${port}/frontend`, {
        transports: ['websocket', 'polling']
      });

      const failTimer = setTimeout(() => {
        frontendClient.disconnect();
        done(new Error('Test timeout'));
      }, 20000);

      frontendClient.on('connect_error', (err) => {
        clearTimeout(failTimer);
        done(err);
      });

      frontendClient.on('connect', () => {
        frontendClient.emit('join', { room: 'frontend' });
        
        setTimeout(() => {
          frontendClient.emit('worker:subscribe', { workerId: testWorker.id });
          
          setTimeout(() => {
            frontendClient.emit('worker:unsubscribe', { workerId: testWorker.id });
            
            setTimeout(() => {
              clearTimeout(failTimer);
              frontendClient.disconnect();
              done();
            }, 100);
          }, 100);
        }, 100);
      });

      frontendClient.connect();
    });
  });
});


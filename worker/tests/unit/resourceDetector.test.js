const ResourceDetector = require('../../utils/resourceDetector');
const fs = require('fs');
const si = require('systeminformation');

// Mock fs module
jest.mock('fs');
jest.mock('systeminformation');

describe('ResourceDetector Unit Tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isHostFilesystemAvailable', () => {
    test('should return true when /host/proc and /host/sys exist', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/host/proc' || path === '/host/sys';
      });

      expect(ResourceDetector.isHostFilesystemAvailable()).toBe(true);
    });

    test('should return false when /host/proc does not exist', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/host/sys';
      });

      expect(ResourceDetector.isHostFilesystemAvailable()).toBe(false);
    });

    test('should return false when /host/sys does not exist', () => {
      fs.existsSync.mockImplementation((path) => {
        return path === '/host/proc';
      });

      expect(ResourceDetector.isHostFilesystemAvailable()).toBe(false);
    });
  });

  describe('isCgroupAvailable', () => {
    test('should return true when cgroup directory exists', () => {
      fs.existsSync.mockReturnValue(true);

      expect(ResourceDetector.isCgroupAvailable()).toBe(true);
      expect(fs.existsSync).toHaveBeenCalledWith('/host/sys/fs/cgroup');
    });

    test('should return false when cgroup directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);

      expect(ResourceDetector.isCgroupAvailable()).toBe(false);
    });
  });

  describe('readHostCPUInfo', () => {
    test('should use WORKER_CPU_CORES environment variable', async () => {
      process.env.WORKER_CPU_CORES = '8';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/loadavg') {
          return '2.5 2.0 1.8 2/1234 5678';
        }
        return '';
      });

      const cpuInfo = await ResourceDetector.readHostCPUInfo();

      expect(cpuInfo).toEqual({
        cores: 8,
        physicalCores: 8,
        processors: 1,
        usage: expect.any(Number)
      });
      expect(cpuInfo.usage).toBeGreaterThanOrEqual(0);
      expect(cpuInfo.usage).toBeLessThanOrEqual(100);
    });

    test('should fallback to systeminformation when loadavg cannot be read', async () => {
      process.env.WORKER_CPU_CORES = '4';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('File not found');
      });
      si.currentLoad.mockResolvedValue({ currentLoad: 45.5 });

      const cpuInfo = await ResourceDetector.readHostCPUInfo();

      expect(cpuInfo.cores).toBe(4);
      expect(cpuInfo.usage).toBe(45.5);
      expect(si.currentLoad).toHaveBeenCalled();
    });

    test('should read from /host/proc/cpuinfo when WORKER_CPU_CORES not set', async () => {
      delete process.env.WORKER_CPU_CORES;
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/cpuinfo') {
          return 'processor : 0\nphysical id : 0\ncore id : 0\nprocessor : 1\nphysical id : 0\ncore id : 1';
        }
        if (path === '/host/proc/loadavg') {
          return '1.5 1.0 0.8 2/1234 5678';
        }
        return '';
      });

      const cpuInfo = await ResourceDetector.readHostCPUInfo();

      expect(cpuInfo.cores).toBe(2);
      expect(cpuInfo.physicalCores).toBe(2);
      expect(cpuInfo.usage).toBeGreaterThanOrEqual(0);
    });

    test('should return null on error', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const cpuInfo = await ResourceDetector.readHostCPUInfo();

      expect(cpuInfo).toBeNull();
    });
  });

  describe('readHostRAMInfo', () => {
    test('should read from /host/proc/meminfo', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/meminfo') {
          return 'MemTotal: 16777216 kB\nMemFree: 8388608 kB\nMemAvailable: 12582912 kB\nBuffers: 1048576 kB\nCached: 2097152 kB';
        }
        return '';
      });

      const ramInfo = await ResourceDetector.readHostRAMInfo();

      expect(ramInfo).toHaveProperty('total');
      expect(ramInfo).toHaveProperty('available');
      expect(ramInfo).toHaveProperty('used');
      expect(ramInfo).toHaveProperty('free');
    });

    test('should scale to Mac RAM when WORKER_RAM_GB is set and higher', async () => {
      process.env.WORKER_RAM_GB = '32';
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/meminfo') {
          // Docker VM with 16GB total, 8GB used
          return 'MemTotal: 16777216 kB\nMemFree: 4194304 kB\nMemAvailable: 8388608 kB\nBuffers: 1048576 kB\nCached: 2097152 kB';
        }
        return '';
      });

      const ramInfo = await ResourceDetector.readHostRAMInfo();

      // Should scale to 32GB Mac RAM
      expect(ramInfo.total).toBe(32);
      // Usage percentage from VM (8GB used / 16GB total = 50%) applied to Mac (32GB * 50% = 16GB used)
      expect(ramInfo.used).toBeGreaterThan(0);
      expect(ramInfo.available).toBeLessThan(32);
    });

    test('should return null on error', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const ramInfo = await ResourceDetector.readHostRAMInfo();

      expect(ramInfo).toBeNull();
    });
  });

  describe('getCPUInfo', () => {
    test('should use host CPU info when available', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/loadavg') {
          return '1.0 0.8 0.6 2/1234 5678';
        }
        return '';
      });
      process.env.WORKER_CPU_CORES = '4';

      const cpuInfo = await ResourceDetector.getCPUInfo();

      expect(cpuInfo.cores).toBe(4);
      expect(fs.existsSync).toHaveBeenCalledWith('/host/proc');
    });

    test('should fallback to systeminformation when host filesystem not available', async () => {
      fs.existsSync.mockReturnValue(false);
      si.cpu.mockResolvedValue({
        cores: 8,
        physicalCores: 4,
        processors: 1
      });
      si.currentLoad.mockResolvedValue({ currentLoad: 25.5 });

      const cpuInfo = await ResourceDetector.getCPUInfo();

      expect(cpuInfo.cores).toBe(8);
      expect(cpuInfo.usage).toBe(25.5);
      expect(si.cpu).toHaveBeenCalled();
    });

    test('should return default values on error', async () => {
      fs.existsSync.mockReturnValue(false);
      si.cpu.mockRejectedValue(new Error('Error'));

      const cpuInfo = await ResourceDetector.getCPUInfo();

      expect(cpuInfo).toEqual({
        cores: 1,
        physicalCores: 1,
        processors: 1,
        usage: 0
      });
    });
  });

  describe('getRAMInfo', () => {
    test('should scale to Mac RAM when WORKER_RAM_GB is set', async () => {
      process.env.WORKER_RAM_GB = '16';
      si.mem.mockResolvedValue({
        total: 8589934592, // 8GB in bytes (Docker VM)
        used: 4294967296,  // 4GB used
        available: 4294967296,
        free: 2147483648
      });
      fs.existsSync.mockReturnValue(false);

      const ramInfo = await ResourceDetector.getRAMInfo();

      // Should scale to 16GB Mac RAM (50% usage = 8GB used)
      expect(ramInfo.total).toBe(16);
      expect(ramInfo.used).toBeGreaterThan(0);
      expect(ramInfo.available).toBeLessThan(16);
    });

    test('should use container values when WORKER_RAM_GB not set', async () => {
      delete process.env.WORKER_RAM_GB;
      si.mem.mockResolvedValue({
        total: 8589934592, // 8GB
        used: 4294967296,  // 4GB
        available: 4294967296,
        free: 2147483648
      });

      const ramInfo = await ResourceDetector.getRAMInfo();

      expect(ramInfo.total).toBe(8);
      expect(ramInfo.used).toBe(4);
    });

    test('should use cgroup memory when available', async () => {
      si.mem.mockResolvedValue({
        total: 8589934592,
        used: 4294967296,
        available: 4294967296,
        free: 2147483648
      });
      fs.existsSync.mockImplementation((path) => {
        return path === '/host/sys/fs/cgroup/memory/memory.usage_in_bytes';
      });
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/sys/fs/cgroup/memory/memory.usage_in_bytes') {
          return '3221225472'; // 3GB used
        }
        if (path === '/host/sys/fs/cgroup/memory/memory.limit_in_bytes') {
          return '8589934592'; // 8GB limit
        }
        return '';
      });

      const ramInfo = await ResourceDetector.getRAMInfo();

      expect(ramInfo).toHaveProperty('total');
      expect(ramInfo).toHaveProperty('used');
    });

    test('should return default values on error', async () => {
      si.mem.mockRejectedValue(new Error('Error'));

      const ramInfo = await ResourceDetector.getRAMInfo();

      expect(ramInfo).toEqual({
        total: 0,
        available: 0,
        used: 0,
        free: 0
      });
    });
  });

  describe('getDiskInfo', () => {
    test('should scale to Mac disk when WORKER_DISK_GB is set and significantly different', async () => {
      process.env.WORKER_DISK_GB = '500';
      si.fsSize.mockResolvedValue([{
        mount: '/',
        size: 107374182400, // 100GB Docker VM
        used: 53687091200,  // 50GB used
        available: 53687091200
      }]);

      const diskInfo = await ResourceDetector.getDiskInfo();

      // Should scale to 500GB Mac disk (50% usage = 250GB used)
      expect(diskInfo.total).toBe(500);
      expect(diskInfo.used).toBeGreaterThan(0);
      expect(diskInfo.available).toBeLessThan(500);
    });

    test('should use container values when WORKER_DISK_GB not set', async () => {
      delete process.env.WORKER_DISK_GB;
      si.fsSize.mockResolvedValue([{
        mount: '/',
        size: 107374182400, // 100GB
        used: 53687091200,  // 50GB
        available: 53687091200
      }]);

      const diskInfo = await ResourceDetector.getDiskInfo();

      expect(diskInfo.total).toBe(100);
      expect(diskInfo.used).toBe(50);
    });

    test('should use container values when WORKER_DISK_GB is similar (within 20%)', async () => {
      process.env.WORKER_DISK_GB = '110'; // Only 10% different, not significant
      si.fsSize.mockResolvedValue([{
        mount: '/',
        size: 107374182400, // 100GB
        used: 53687091200,  // 50GB
        available: 53687091200
      }]);

      const diskInfo = await ResourceDetector.getDiskInfo();

      // Should use container values directly (not scaled)
      expect(diskInfo.total).toBe(100);
      expect(diskInfo.used).toBe(50);
    });

    test('should handle empty fsSize array', async () => {
      si.fsSize.mockResolvedValue([]);

      const diskInfo = await ResourceDetector.getDiskInfo();

      expect(diskInfo.total).toBe(0);
      expect(diskInfo.used).toBe(0);
      expect(diskInfo.available).toBe(0);
    });

    test('should return default values on error', async () => {
      si.fsSize.mockRejectedValue(new Error('Error'));

      const diskInfo = await ResourceDetector.getDiskInfo();

      expect(diskInfo).toEqual({
        total: 0,
        available: 0,
        used: 0
      });
    });
  });

  describe('readHostDiskInfo', () => {
    test('should read disk info with WORKER_DISK_GB set', async () => {
      process.env.WORKER_DISK_GB = '500';
      const { execSync } = require('child_process');
      
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/mounts') {
          return '/dev/sda1 / ext4 rw 0 0';
        }
        return '';
      });
      
      // Mock execSync for df command
      jest.spyOn(require('child_process'), 'execSync').mockReturnValue(
        'Filesystem 1G-blocks Used Available Use% Mounted on\n/dev/sda1 100 50 50 50% /host'
      );

      const diskInfo = await ResourceDetector.readHostDiskInfo();

      expect(diskInfo).toHaveProperty('total');
      expect(diskInfo).toHaveProperty('used');
      expect(diskInfo).toHaveProperty('available');
    });

    test('should return null when all methods fail', async () => {
      delete process.env.WORKER_DISK_GB;
      fs.existsSync.mockReturnValue(false);
      
      // Mock execSync to throw error
      jest.spyOn(require('child_process'), 'execSync').mockImplementation(() => {
        throw new Error('execSync error');
      });

      const diskInfo = await ResourceDetector.readHostDiskInfo();

      // When WORKER_DISK_GB is not set and /host/proc/mounts doesn't exist, should return null
      expect(diskInfo).toBeNull();
    });
  });

  describe('readHostNetworkInfo', () => {
    test('should read network info from /host/proc/net/dev', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation((path) => {
        if (path === '/host/proc/net/dev') {
          return 'Inter-|   Receive                                                |  Transmit\n face |bytes    packets errs drop fifo frame compressed multicast|bytes    packets errs drop fifo colls carrier compressed\neth0: 1000000 1000    0    0    0     0          0         0 2000000 2000    0    0    0     0       0          0';
        }
        return '';
      });

      const networkInfo = await ResourceDetector.readHostNetworkInfo();

      expect(networkInfo).toBeNull(); // Returns null to fallback to container info
    });

    test('should return null on error', async () => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockImplementation(() => {
        throw new Error('Read error');
      });

      const networkInfo = await ResourceDetector.readHostNetworkInfo();

      expect(networkInfo).toBeNull();
    });
  });

  describe('getNetworkInfo', () => {
    test('should return network information', async () => {
      si.networkInterfaces.mockResolvedValue([
        {
          iface: 'eth0',
          ip4: '192.168.1.100',
          mac: '00:11:22:33:44:55',
          speed: 1000,
          internal: false
        }
      ]);
      si.networkStats.mockResolvedValue([{
        iface: 'eth0',
        rx_bytes: 1000000,
        tx_bytes: 2000000
      }]);

      const networkInfo = await ResourceDetector.getNetworkInfo();

      expect(networkInfo).toHaveProperty('interfaces');
      expect(networkInfo).toHaveProperty('primaryInterface');
      expect(networkInfo).toHaveProperty('ip4');
      expect(networkInfo).toHaveProperty('mac');
      expect(networkInfo).toHaveProperty('speed');
    });

    test('should handle empty network interfaces', async () => {
      si.networkInterfaces.mockResolvedValue([]);
      si.networkStats.mockResolvedValue([]);

      const networkInfo = await ResourceDetector.getNetworkInfo();

      expect(networkInfo.interfaces).toBe(0);
      expect(networkInfo.primaryInterface).toBe('unknown');
    });

    test('should filter out Docker interfaces', async () => {
      si.networkInterfaces.mockResolvedValue([
        {
          iface: 'eth0',
          ip4: '192.168.1.100',
          mac: '00:11:22:33:44:55',
          speed: 1000,
          internal: false
        },
        {
          iface: 'docker0',
          ip4: '172.17.0.1',
          internal: false
        },
        {
          iface: 'veth123',
          ip4: '172.17.0.2',
          internal: false
        }
      ]);
      si.networkStats.mockResolvedValue([{
        iface: 'eth0',
        rx_bytes: 0,
        tx_bytes: 0
      }]);

      const networkInfo = await ResourceDetector.getNetworkInfo();

      expect(networkInfo.primaryInterface).toBe('eth0');
    });

    test('should return default values on error', async () => {
      si.networkInterfaces.mockRejectedValue(new Error('Error'));
      si.networkStats.mockRejectedValue(new Error('Error'));

      const networkInfo = await ResourceDetector.getNetworkInfo();

      expect(networkInfo.interfaces).toBe(0);
      expect(networkInfo.primaryInterface).toBe('unknown');
      expect(networkInfo.ip4).toBe('unknown');
    });
  });

  describe('getAllResources', () => {
    test('should return all resource information', async () => {
      si.cpu.mockResolvedValue({ cores: 4, physicalCores: 2, processors: 1 });
      si.currentLoad.mockResolvedValue({ currentLoad: 25 });
      si.mem.mockResolvedValue({
        total: 8589934592,
        used: 4294967296,
        available: 4294967296,
        free: 2147483648
      });
      si.fsSize.mockResolvedValue([{
        mount: '/',
        size: 107374182400,
        used: 53687091200,
        available: 53687091200
      }]);
      si.fsStats = jest.fn().mockResolvedValue({ rx: 0, wx: 0, rx_sec: 0, wx_sec: 0 });
      si.memLayout = jest.fn().mockResolvedValue([]);
      si.networkStats = jest.fn().mockResolvedValue([{
        iface: 'eth0',
        rx_bytes: 0,
        tx_bytes: 0
      }]);
      si.networkInterfaces.mockResolvedValue([{
        iface: 'eth0',
        ip4: '192.168.1.100',
        mac: '00:11:22:33:44:55',
        speed: 1000
      }]);
      fs.existsSync.mockReturnValue(false);

      const resources = await ResourceDetector.getAllResources();

      expect(resources).toHaveProperty('cpu');
      expect(resources).toHaveProperty('ram');
      expect(resources).toHaveProperty('disk');
      expect(resources).toHaveProperty('network');
      expect(resources).toHaveProperty('cpu_cores');
      expect(resources).toHaveProperty('ram_gb');
      expect(resources).toHaveProperty('disk_gb');
      expect(resources).toHaveProperty('network_mbps');
      expect(resources.cpu_cores).toBeGreaterThan(0);
    });
  });
});

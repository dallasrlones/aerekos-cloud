const ResourceDetector = require('../../utils/resourceDetector');

describe('ResourceDetector Unit Tests', () => {
  describe('getCPUInfo', () => {
    test('should return CPU information', async () => {
      const cpuInfo = await ResourceDetector.getCPUInfo();
      
      expect(cpuInfo).toHaveProperty('cores');
      expect(cpuInfo).toHaveProperty('physicalCores');
      expect(cpuInfo).toHaveProperty('processors');
      expect(cpuInfo).toHaveProperty('usage');
      expect(typeof cpuInfo.cores).toBe('number');
      expect(cpuInfo.cores).toBeGreaterThan(0);
    });
  });

  describe('getRAMInfo', () => {
    test('should return RAM information', async () => {
      const ramInfo = await ResourceDetector.getRAMInfo();
      
      expect(ramInfo).toHaveProperty('total');
      expect(ramInfo).toHaveProperty('available');
      expect(ramInfo).toHaveProperty('used');
      expect(ramInfo).toHaveProperty('free');
      expect(typeof ramInfo.total).toBe('number');
      expect(ramInfo.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getDiskInfo', () => {
    test('should return disk information', async () => {
      const diskInfo = await ResourceDetector.getDiskInfo();
      
      expect(diskInfo).toHaveProperty('total');
      expect(diskInfo).toHaveProperty('available');
      expect(diskInfo).toHaveProperty('used');
      expect(typeof diskInfo.total).toBe('number');
      expect(diskInfo.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('getNetworkInfo', () => {
    test('should return network information', async () => {
      const networkInfo = await ResourceDetector.getNetworkInfo();
      
      expect(networkInfo).toHaveProperty('interfaces');
      expect(networkInfo).toHaveProperty('primaryInterface');
      expect(networkInfo).toHaveProperty('ip4');
      expect(networkInfo).toHaveProperty('mac');
      expect(networkInfo).toHaveProperty('speed');
      expect(typeof networkInfo.interfaces).toBe('number');
    });
  });

  describe('getAllResources', () => {
    test('should return all resource information', async () => {
      const resources = await ResourceDetector.getAllResources();
      
      expect(resources).toHaveProperty('cpu');
      expect(resources).toHaveProperty('ram');
      expect(resources).toHaveProperty('disk');
      expect(resources).toHaveProperty('network');
      expect(resources).toHaveProperty('cpu_cores');
      expect(resources).toHaveProperty('ram_gb');
      expect(resources).toHaveProperty('disk_gb');
      expect(resources).toHaveProperty('network_mbps');
      
      expect(typeof resources.cpu_cores).toBe('number');
      expect(typeof resources.ram_gb).toBe('number');
      expect(typeof resources.disk_gb).toBe('number');
      expect(typeof resources.network_mbps).toBe('number');
      
      expect(resources.cpu_cores).toBeGreaterThan(0);
      expect(resources.ram_gb).toBeGreaterThanOrEqual(0);
      expect(resources.disk_gb).toBeGreaterThanOrEqual(0);
    });
  });
});


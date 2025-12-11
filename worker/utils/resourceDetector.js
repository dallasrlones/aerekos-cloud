const si = require('systeminformation');
const fs = require('fs');
const path = require('path');

/**
 * Resource Detector - Detects system resources (CPU, RAM, disk, network)
 * When running in Docker, reads from mounted host filesystems to get actual device resources
 */
class ResourceDetector {
  /**
   * Check if we're in Docker and host filesystems are mounted
   * @returns {boolean} True if host filesystems are available
   */
  isHostFilesystemAvailable() {
    return fs.existsSync('/host/proc') && fs.existsSync('/host/sys');
  }

  /**
   * Read CPU info directly from host /proc/cpuinfo
   * Prioritizes WORKER_CPU_CORES from entrypoint script detection
   * @returns {Promise<object>} CPU info
   */
  async readHostCPUInfo() {
    try {
      // Priority 1: Use WORKER_CPU_CORES from entrypoint script
      const workerCPU = process.env.WORKER_CPU_CORES;
      if (workerCPU) {
        const cores = parseInt(workerCPU);
        if (cores && cores > 0) {
          // Read load average from /host/proc/loadavg
          let usage = 0;
          try {
            const loadavg = fs.readFileSync('/host/proc/loadavg', 'utf8').trim().split(/\s+/);
            const load1 = parseFloat(loadavg[0]) || 0;
            usage = Math.min((load1 / cores) * 100, 100);
          } catch (e) {
            // If we can't read loadavg, use systeminformation
            const currentLoad = await si.currentLoad();
            usage = currentLoad.currentLoad || 0;
          }
          
          return {
            cores: cores,
            physicalCores: cores, // Assume same if not detected
            processors: 1,
            usage: usage
          };
        }
      }
      
      // Priority 2: Read from /host/proc/cpuinfo
      const cpuinfo = fs.readFileSync('/host/proc/cpuinfo', 'utf8');
      const cores = (cpuinfo.match(/^processor\s*:/gm) || []).length;
      
      // Count physical cores (count unique physical id + core id combinations)
      const physicalIds = new Set();
      const lines = cpuinfo.split('\n');
      let currentPhysicalId = null;
      let currentCoreId = null;
      
      for (const line of lines) {
        if (line.startsWith('physical id')) {
          currentPhysicalId = line.split(':')[1].trim();
        } else if (line.startsWith('core id')) {
          currentCoreId = line.split(':')[1].trim();
          if (currentPhysicalId !== null && currentCoreId !== null) {
            physicalIds.add(`${currentPhysicalId}-${currentCoreId}`);
          }
        }
      }
      
      const physicalCores = physicalIds.size || cores;
      
      // Read load average from /host/proc/loadavg
      const loadavg = fs.readFileSync('/host/proc/loadavg', 'utf8').trim().split(/\s+/);
      const load1 = parseFloat(loadavg[0]) || 0;
      const usage = Math.min((load1 / cores) * 100, 100);
      
      return {
        cores: cores || 1,
        physicalCores: physicalCores || 1,
        processors: 1,
        usage: usage
      };
    } catch (error) {
      console.error('Error reading host CPU info:', error);
      return null;
    }
  }

  /**
   * Get CPU information from host (if mounted) or container
   * @returns {Promise<object>} CPU info (cores, usage)
   */
  async getCPUInfo() {
    try {
      if (this.isHostFilesystemAvailable()) {
        const hostCPU = await this.readHostCPUInfo();
        if (hostCPU) {
          return hostCPU;
        }
      }
      
      // Fallback to container/system info
      const cpu = await si.cpu();
      const currentLoad = await si.currentLoad();
      
      return {
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors,
        usage: currentLoad.currentLoad || 0
      };
    } catch (error) {
      console.error('Error getting CPU info:', error);
      return {
        cores: 1,
        physicalCores: 1,
        processors: 1,
        usage: 0
      };
    }
  }

  /**
   * Read RAM info directly from host /proc/meminfo
   * Prioritizes WORKER_RAM_GB from entrypoint script detection
   * @returns {Promise<object>} RAM info
   */
  async readHostRAMInfo() {
    try {
      // Priority 1: Use WORKER_RAM_GB from entrypoint script (detected from host)
      const workerRAM = process.env.WORKER_RAM_GB;
      if (workerRAM) {
        const totalGB = parseInt(workerRAM);
        if (totalGB && totalGB > 0) {
          // Try to get available memory from /host/proc/meminfo if available
          let availableGB = 0;
          let usedGB = 0;
          try {
            const meminfo = fs.readFileSync('/host/proc/meminfo', 'utf8');
            const lines = meminfo.split('\n');
            for (const line of lines) {
              if (line.startsWith('MemAvailable:')) {
                const availableKB = parseInt(line.split(/\s+/)[1]);
                // Scale available memory proportionally to actual RAM
                const detectedTotalKB = parseInt(
                  meminfo.split('\n').find(l => l.startsWith('MemTotal:'))?.split(/\s+/)[1] || '0'
                );
                if (detectedTotalKB > 0) {
                  availableGB = (availableKB / detectedTotalKB) * totalGB;
                  usedGB = totalGB - availableGB;
                } else {
                  // Estimate used as 50% if we can't calculate
                  usedGB = totalGB * 0.5;
                  availableGB = totalGB - usedGB;
                }
                break;
              }
            }
          } catch (e) {
            // If we can't read meminfo, estimate used as 50% (conservative)
            usedGB = totalGB * 0.5;
            availableGB = totalGB - usedGB;
          }
          
          return {
            total: Math.round(totalGB),
            available: Math.round(availableGB),
            used: Math.round(usedGB),
            free: Math.round(availableGB)
          };
        }
      }
      
      // Priority 2: Read from /host/proc/meminfo (Linux or Docker VM)
      const meminfo = fs.readFileSync('/host/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      
      let total = 0, available = 0, free = 0;
      
      for (const line of lines) {
        if (line.startsWith('MemTotal:')) {
          total = parseInt(line.split(/\s+/)[1]) / 1024 / 1024; // Convert KB to GB
        } else if (line.startsWith('MemAvailable:')) {
          available = parseInt(line.split(/\s+/)[1]) / 1024 / 1024;
        } else if (line.startsWith('MemFree:')) {
          free = parseInt(line.split(/\s+/)[1]) / 1024 / 1024;
        }
      }
      
      return {
        total: Math.round(total),
        available: Math.round(available),
        used: Math.round(total - available),
        free: Math.round(free)
      };
    } catch (error) {
      console.error('Error reading host RAM info:', error);
      return null;
    }
  }

  /**
   * Get RAM information from host (if mounted) or container
   * @returns {Promise<object>} RAM info (total, available, used)
   */
  async getRAMInfo() {
    try {
      if (this.isHostFilesystemAvailable()) {
        const hostRAM = await this.readHostRAMInfo();
        if (hostRAM) {
          return hostRAM;
        }
      }
      
      // Fallback to container/system info
      const mem = await si.mem();
      
      return {
        total: Math.round(mem.total / 1024 / 1024 / 1024), // Convert to GB
        available: Math.round(mem.available / 1024 / 1024 / 1024), // Convert to GB
        used: Math.round(mem.used / 1024 / 1024 / 1024), // Convert to GB
        free: Math.round(mem.free / 1024 / 1024 / 1024) // Convert to GB
      };
    } catch (error) {
      console.error('Error getting RAM info:', error);
      return {
        total: 0,
        available: 0,
        used: 0,
        free: 0
      };
    }
  }

  /**
   * Read disk info from host filesystems
   * Prioritizes WORKER_DISK_GB from entrypoint script detection
   * @returns {Promise<object>} Disk info
   */
  async readHostDiskInfo() {
    try {
      // Priority 1: Use WORKER_DISK_GB from entrypoint script
      const workerDisk = process.env.WORKER_DISK_GB;
      if (workerDisk) {
        const totalGB = parseInt(workerDisk);
        if (totalGB && totalGB > 0) {
          // Try to get used/available from /host/proc/mounts and df
          let availableGB = 0;
          let usedGB = 0;
          try {
            const { execSync } = require('child_process');
            const dfOutput = execSync('df -BG /', { encoding: 'utf8' }).trim();
            const lines = dfOutput.split('\n');
            if (lines.length > 1) {
              const stats = lines[1].split(/\s+/);
              if (stats.length >= 4) {
                const usedBytes = parseInt(stats[2].replace('G', '')) || 0;
                const availBytes = parseInt(stats[3].replace('G', '')) || 0;
                // Scale proportionally to actual disk size
                const detectedTotal = parseInt(stats[1].replace('G', '')) || totalGB;
                if (detectedTotal > 0) {
                  usedGB = (usedBytes / detectedTotal) * totalGB;
                  availableGB = (availBytes / detectedTotal) * totalGB;
                } else {
                  // Estimate if we can't calculate
                  usedGB = totalGB * 0.7;
                  availableGB = totalGB - usedGB;
                }
              }
            }
          } catch (e) {
            // Estimate if we can't calculate
            usedGB = totalGB * 0.7;
            availableGB = totalGB - usedGB;
          }
          
          return {
            total: Math.round(totalGB),
            available: Math.round(availableGB),
            used: Math.round(usedGB)
          };
        }
      }
      
      // Priority 2: Read from /host/sys/block or df
      const { execSync } = require('child_process');
      const mounts = fs.readFileSync('/host/proc/mounts', 'utf8');
      const lines = mounts.split('\n');
      
      // Find root filesystem device
      let rootDevice = null;
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length >= 2 && parts[1] === '/') {
          rootDevice = parts[0];
          break;
        }
      }
      
      if (rootDevice) {
        const deviceName = rootDevice.replace('/dev/', '').replace(/[0-9]+$/, '');
        if (deviceName && fs.existsSync(`/host/sys/block/${deviceName}/size`)) {
          const sectors = parseInt(fs.readFileSync(`/host/sys/block/${deviceName}/size`, 'utf8').trim());
          const totalBytes = sectors * 512;
          const totalGB = Math.round(totalBytes / 1024 / 1024 / 1024);
          
          // Get used/available from df
          try {
            const dfOutput = execSync('df -BG /', { encoding: 'utf8' }).trim();
            const dfLines = dfOutput.split('\n');
            if (dfLines.length > 1) {
              const stats = dfLines[1].split(/\s+/);
              const usedGB = parseInt(stats[2].replace('G', '')) || 0;
              const availableGB = parseInt(stats[3].replace('G', '')) || 0;
              return {
                total: totalGB,
                available: availableGB,
                used: usedGB
              };
            }
          } catch (e) {
            // Fall through
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error reading host disk info:', error);
      return null;
    }
  }

  /**
   * Get disk information from host (if mounted) or container
   * @returns {Promise<object>} Disk info (total, available, used)
   */
  async getDiskInfo() {
    try {
      if (this.isHostFilesystemAvailable()) {
        const hostDisk = await this.readHostDiskInfo();
        if (hostDisk) {
          return hostDisk;
        }
      }
      
      // Fallback to container/system info
      const fsSize = await si.fsSize();
      
      // Sum up all filesystems
      let total = 0;
      let available = 0;
      let used = 0;
      
      fsSize.forEach(fs => {
        total += fs.size || 0;
        available += fs.available || 0;
        used += fs.used || 0;
      });
      
      return {
        total: Math.round(total / 1024 / 1024 / 1024), // Convert to GB
        available: Math.round(available / 1024 / 1024 / 1024), // Convert to GB
        used: Math.round(used / 1024 / 1024 / 1024) // Convert to GB
      };
    } catch (error) {
      console.error('Error getting disk info:', error);
      return {
        total: 0,
        available: 0,
        used: 0
      };
    }
  }

  /**
   * Read network info from host /proc/net/dev and /sys/class/net
   * @returns {Promise<object>} Network info
   */
  async readHostNetworkInfo() {
    try {
      // Read network interfaces from host
      const netDev = fs.readFileSync('/host/proc/net/dev', 'utf8');
      const lines = netDev.split('\n').slice(2); // Skip header lines
      
      const interfaces = [];
      for (const line of lines) {
        const match = line.match(/^\s*(\w+):/);
        if (match && !match[1].startsWith('docker') && !match[1].startsWith('br-') && !match[1].startsWith('veth')) {
          interfaces.push(match[1]);
        }
      }
      
      // Use os.networkInterfaces() which should see host interfaces when /host/proc is mounted
      // But we need to read from host's actual network config
      // For now, use systeminformation but it will read from container
      // Network info is less critical, so we'll use container info as fallback
      return null; // Will fallback to container info
    } catch (error) {
      console.error('Error reading host network info:', error);
      return null;
    }
  }

  /**
   * Get network information from host (if mounted) or container
   * @returns {Promise<object>} Network info (interfaces, bandwidth)
   */
  async getNetworkInfo() {
    try {
      // Network info is trickier - use container info for now
      // The important thing is CPU, RAM, and disk which we can read from /host/proc
      const networkInterfaces = await si.networkInterfaces();
      const networkStats = await si.networkStats();
      
      // Filter out Docker interfaces
      const hostInterfaces = networkInterfaces.filter(iface => 
        !iface.internal && 
        !iface.iface.startsWith('docker') && 
        !iface.iface.startsWith('br-') && 
        !iface.iface.startsWith('veth')
      );
      
      // Get primary network interface (usually the first active one)
      const primaryInterface = hostInterfaces.find(iface => 
        iface.ip4 && iface.ip4 !== '127.0.0.1'
      ) || hostInterfaces[0] || networkInterfaces.find(iface => 
        !iface.internal && iface.ip4 && iface.ip4 !== '127.0.0.1'
      ) || networkInterfaces[0];
      
      // Get stats for primary interface
      const primaryStats = networkStats.find(stat => 
        stat.iface === primaryInterface?.iface
      ) || networkStats[0];
      
      return {
        interfaces: hostInterfaces.length || networkInterfaces.length,
        primaryInterface: primaryInterface?.iface || 'unknown',
        ip4: primaryInterface?.ip4 || 'unknown',
        ip6: primaryInterface?.ip6 || null,
        mac: primaryInterface?.mac || 'unknown',
        speed: primaryInterface?.speed || 1000, // Default to 1000 Mbps if unknown
        rx_bytes: primaryStats?.rx_bytes || 0,
        tx_bytes: primaryStats?.tx_bytes || 0
      };
    } catch (error) {
      console.error('Error getting network info:', error);
      return {
        interfaces: 0,
        primaryInterface: 'unknown',
        ip4: 'unknown',
        ip6: null,
        mac: 'unknown',
        speed: 1000,
        rx_bytes: 0,
        tx_bytes: 0
      };
    }
  }

  /**
   * Get all resource information with detailed metrics
   * @returns {Promise<object>} All resource info
   */
  async getAllResources() {
    const [cpu, ram, disk, network, cpuLoad, diskIO, memLayout] = await Promise.all([
      this.getCPUInfo(),
      this.getRAMInfo(),
      this.getDiskInfo(),
      this.getNetworkInfo(),
      si.currentLoad().catch(() => ({ currentLoad: 0, cpus: [] })),
      si.fsStats().catch(() => ({ rx: 0, wx: 0, rx_sec: 0, wx_sec: 0 })),
      si.memLayout().catch(() => [])
    ]);

    // Calculate network I/O rates (bytes per second)
    const networkStats = await si.networkStats().catch(() => []);
    const primaryStats = networkStats.find(stat => 
      stat.iface === network.primaryInterface
    ) || networkStats[0] || {};

    // Get per-core CPU usage if available
    const perCoreUsage = cpuLoad.cpus || [];
    
    // Calculate RAM percentage
    const ramUsagePercent = ram.total > 0 ? ((ram.used / ram.total) * 100).toFixed(2) : 0;
    const diskUsagePercent = disk.total > 0 ? ((disk.used / disk.total) * 100).toFixed(2) : 0;

    return {
      timestamp: new Date().toISOString(),
      cpu: {
        cores: cpu.cores,
        physicalCores: cpu.physicalCores,
        processors: cpu.processors || 1,
        usage: cpu.usage || cpuLoad.currentLoad || 0,
        usagePercent: (cpu.usage || cpuLoad.currentLoad || 0).toFixed(2),
        perCore: perCoreUsage.map((core, idx) => ({
          core: idx + 1,
          usage: core.load || 0,
          usagePercent: (core.load || 0).toFixed(2)
        })),
        model: cpu.model || 'unknown',
        speed: cpu.speed || 0
      },
      ram: {
        total_gb: ram.total,
        available_gb: ram.available,
        used_gb: ram.used,
        free_gb: ram.free || (ram.total - ram.used),
        usagePercent: parseFloat(ramUsagePercent),
        total_bytes: ram.total * 1024 * 1024 * 1024,
        used_bytes: ram.used * 1024 * 1024 * 1024,
        available_bytes: ram.available * 1024 * 1024 * 1024
      },
      disk: {
        total_gb: disk.total,
        available_gb: disk.available,
        used_gb: disk.used,
        usagePercent: parseFloat(diskUsagePercent),
        read_bytes: diskIO.rx || 0,
        write_bytes: diskIO.wx || 0,
        read_bytes_per_sec: diskIO.rx_sec || 0,
        write_bytes_per_sec: diskIO.wx_sec || 0,
        total_bytes: disk.total * 1024 * 1024 * 1024,
        used_bytes: disk.used * 1024 * 1024 * 1024,
        available_bytes: disk.available * 1024 * 1024 * 1024
      },
      network: {
        interfaces: network.interfaces,
        primary_interface: network.primaryInterface,
        ip4: network.ip4,
        ip6: network.ip6,
        mac: network.mac,
        speed_mbps: network.speed,
        rx_bytes: primaryStats.rx_bytes || network.rx_bytes || 0,
        tx_bytes: primaryStats.tx_bytes || network.tx_bytes || 0,
        rx_bytes_per_sec: primaryStats.rx_sec || 0,
        tx_bytes_per_sec: primaryStats.tx_sec || 0,
        rx_dropped: primaryStats.rx_dropped || 0,
        tx_dropped: primaryStats.tx_dropped || 0,
        rx_errors: primaryStats.rx_errors || 0,
        tx_errors: primaryStats.tx_errors || 0
      },
      // Simplified format for conductor API (backward compatibility)
      cpu_cores: cpu.cores,
      ram_gb: ram.total,
      disk_gb: disk.total,
      network_mbps: network.speed || 1000
    };
  }
}

module.exports = new ResourceDetector();


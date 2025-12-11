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
   * Check if cgroup filesystem is available (Linux hosts only)
   * On macOS Docker, cgroups may not be mounted - that's OK, we fall back gracefully
   * @returns {boolean} True if cgroup is mounted and accessible
   */
  isCgroupAvailable() {
    return fs.existsSync('/host/sys/fs/cgroup');
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
   * Auto-detects Mac RAM and applies real-time usage
   * @returns {Promise<object>} RAM info
   */
  async readHostRAMInfo() {
    try {
      // Always read from /host/proc/meminfo for real-time usage
      const meminfo = fs.readFileSync('/host/proc/meminfo', 'utf8');
      const lines = meminfo.split('\n');
      
      let totalKB = 0, availableKB = 0, freeKB = 0, buffersKB = 0, cachedKB = 0;
      
      for (const line of lines) {
        if (line.startsWith('MemTotal:')) {
          totalKB = parseInt(line.split(/\s+/)[1]) || 0;
        } else if (line.startsWith('MemAvailable:')) {
          availableKB = parseInt(line.split(/\s+/)[1]) || 0;
        } else if (line.startsWith('MemFree:')) {
          freeKB = parseInt(line.split(/\s+/)[1]) || 0;
        } else if (line.startsWith('Buffers:')) {
          buffersKB = parseInt(line.split(/\s+/)[1]) || 0;
        } else if (line.startsWith('Cached:')) {
          cachedKB = parseInt(line.split(/\s+/)[1]) || 0;
        }
      }
      
      // Convert KB to GB
      let totalGB = totalKB / 1024 / 1024;
      const availableGB = availableKB / 1024 / 1024;
      const freeGB = freeKB / 1024 / 1024;
      const usedGB = totalGB - availableGB;
      
      // Auto-detect: If WORKER_RAM_GB is set and significantly higher than /host/proc,
      // we're on macOS Docker and need to scale usage to actual Mac RAM
      const workerRAM = process.env.WORKER_RAM_GB;
      if (workerRAM) {
        const envRAM = parseInt(workerRAM);
        // If WORKER_RAM_GB is >20% higher than /host/proc, it's Mac RAM vs Docker VM RAM
        if (envRAM && envRAM > totalGB * 1.2) {
          // Calculate real-time usage percentage from Docker VM
          // The VM's memory pressure reflects Mac's memory pressure
          const usagePercent = totalGB > 0 ? (usedGB / totalGB) : 0;
          
          // Apply usage percentage to actual Mac RAM for real-time updates
          const finalTotalGB = envRAM;
          const finalUsedGB = finalTotalGB * usagePercent;
          const finalAvailableGB = finalTotalGB - finalUsedGB;
          
          return {
            total: Math.round(finalTotalGB),
            available: Math.round(finalAvailableGB),
            used: Math.round(finalUsedGB),
            free: Math.round(finalAvailableGB * 0.3) // Estimate free based on available
          };
        }
      }
      
      // Use values directly from /host/proc/meminfo (Linux host or Docker VM)
      return {
        total: Math.round(totalGB),
        available: Math.round(availableGB),
        used: Math.round(usedGB),
        free: Math.round(freeGB)
      };
    } catch (error) {
      console.error('Error reading host RAM info:', error);
      return null;
    }
  }

  /**
   * Get RAM information from host (if mounted) or container
   * Always reads fresh data from /host/proc/meminfo for real-time updates
   * @returns {Promise<object>} RAM info (total, available, used)
   */
  async getRAMInfo() {
    try {
      // Always use systeminformation for real-time, dynamic readings
      // It reads from container's /proc/meminfo which updates frequently
      // Force fresh read by calling mem() each time (no caching)
      const mem = await si.mem();
      const containerTotalGB = mem.total / 1024 / 1024 / 1024;
      const containerUsedGB = mem.used / 1024 / 1024 / 1024;
      const containerAvailableGB = mem.available / 1024 / 1024 / 1024;
      const containerFreeGB = mem.free / 1024 / 1024 / 1024;
      
      // Calculate usage percentage from real-time container memory
      const usagePercent = containerTotalGB > 0 ? (containerUsedGB / containerTotalGB) : 0;
      
      // Priority 1: Try cgroup for more accurate host memory stats (Linux only)
      let cgroupMemoryUsed = null;
      let cgroupMemoryLimit = null;
      
      // Check for cgroup v1 (older Linux systems)
      if (fs.existsSync('/host/sys/fs/cgroup/memory/memory.usage_in_bytes')) {
        try {
          cgroupMemoryUsed = parseInt(fs.readFileSync('/host/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8').trim());
          const limitStr = fs.readFileSync('/host/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8').trim();
          cgroupMemoryLimit = parseInt(limitStr);
          // Max value means unlimited, ignore it
          if (cgroupMemoryLimit >= Number.MAX_SAFE_INTEGER - 1 || cgroupMemoryLimit === -1) {
            cgroupMemoryLimit = null;
          }
        } catch (e) {
          // Cgroup v1 not available, try v2
        }
      }
      
      // Check for cgroup v2 (newer Linux systems)
      if (!cgroupMemoryUsed && fs.existsSync('/host/sys/fs/cgroup/memory.current')) {
        try {
          cgroupMemoryUsed = parseInt(fs.readFileSync('/host/sys/fs/cgroup/memory.current', 'utf8').trim());
          const limitStr = fs.readFileSync('/host/sys/fs/cgroup/memory.max', 'utf8').trim();
          if (limitStr !== 'max') {
            cgroupMemoryLimit = parseInt(limitStr);
          }
        } catch (e2) {
          // Cgroup v2 not available either, fall through
        }
      }
      
      // Use cgroup memory if available (more accurate) - update usage percentage
      let finalUsagePercent = usagePercent;
      if (cgroupMemoryUsed && cgroupMemoryLimit && cgroupMemoryLimit < Number.MAX_SAFE_INTEGER) {
        // Cgroup limit is set and not max - use cgroup usage for more accurate percentage
        const cgroupUsedGB = cgroupMemoryUsed / 1024 / 1024 / 1024;
        const cgroupLimitGB = cgroupMemoryLimit / 1024 / 1024 / 1024;
        finalUsagePercent = cgroupLimitGB > 0 ? (cgroupUsedGB / cgroupLimitGB) : usagePercent;
      }
      
      // Auto-detect: If WORKER_RAM_GB is set and significantly higher, we're on macOS Docker
      // Scale container usage percentage to actual Mac RAM for real-time updates
      const workerRAM = process.env.WORKER_RAM_GB;
      if (workerRAM) {
        const envRAM = parseInt(workerRAM);
        if (envRAM && envRAM > containerTotalGB * 1.2) {
          // Mac RAM detected - scale usage percentage to Mac RAM
          // Use real-time usage percentage from container memory (updates every heartbeat)
          // Keep 2 decimal places for precision so small changes are visible
          const macUsedGB = Math.round((envRAM * finalUsagePercent) * 100) / 100;
          const macAvailableGB = Math.round((envRAM - macUsedGB) * 100) / 100;
          
          return {
            total: envRAM,
            available: macAvailableGB,
            used: macUsedGB,
            free: Math.round((macAvailableGB * (containerFreeGB / containerAvailableGB)) * 100) / 100
          };
        }
      }
      
      // Use container/host values directly
      return {
        total: Math.round(containerTotalGB),
        available: Math.round(containerAvailableGB),
        used: Math.round(containerUsedGB),
        free: Math.round(containerFreeGB)
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
   * Reads actual host disk usage, not container filesystem
   * @returns {Promise<object>} Disk info
   */
  async readHostDiskInfo() {
    try {
      const { execSync } = require('child_process');
      
      // Priority 1: Use WORKER_DISK_GB from entrypoint script
      const workerDisk = process.env.WORKER_DISK_GB;
      if (workerDisk) {
        const totalGB = parseInt(workerDisk);
        if (totalGB && totalGB > 0) {
          // Try to get used/available from host's actual root filesystem
          let availableGB = 0;
          let usedGB = 0;
          
          try {
            // Auto-detect: Try to read host disk usage from multiple sources
            // Priority 1: Try reading from host's root filesystem via /host/proc/mounts
            const hostMounts = fs.readFileSync('/host/proc/mounts', 'utf8');
            const mountLines = hostMounts.split('\n');
            
            // Find the host's root filesystem mount point
            let hostRootDevice = null;
            for (const line of mountLines) {
              const parts = line.split(/\s+/);
              if (parts.length >= 2 && parts[1] === '/') {
                hostRootDevice = parts[0];
                break;
              }
            }
            
            if (hostRootDevice) {
              // Try multiple methods to get host disk usage
              let dfOutput = null;
              let dfPaths = ['/host', '/host/proc', '/host/sys'];
              
              // Try each path to find one that shows host filesystem
              for (const dfPath of dfPaths) {
                try {
                  dfOutput = execSync(`df -BG ${dfPath} 2>/dev/null`, { encoding: 'utf8' }).trim();
                  if (dfOutput && dfOutput.includes('Filesystem')) {
                    break;
                  }
                } catch (e) {
                  continue;
                }
              }
              
              if (dfOutput) {
                const lines = dfOutput.split('\n');
                if (lines.length > 1) {
                  const stats = lines[1].split(/\s+/);
                  if (stats.length >= 4) {
                    const detectedTotal = parseInt(stats[1].replace('G', '')) || 0;
                    const usedBytes = parseInt(stats[2].replace('G', '')) || 0;
                    const availBytes = parseInt(stats[3].replace('G', '')) || 0;
                    
                    // Auto-detect: If WORKER_DISK_GB is significantly different from detected,
                    // we're on macOS Docker - scale usage percentage to actual Mac disk
                    const workerDisk = process.env.WORKER_DISK_GB;
                    if (workerDisk) {
                      const envDisk = parseInt(workerDisk);
                      if (envDisk && Math.abs(envDisk - detectedTotal) > detectedTotal * 0.2) {
                        // Mac disk vs Docker VM disk - scale usage percentage
                        const usagePercent = detectedTotal > 0 ? (usedBytes / detectedTotal) : 0;
                        usedGB = envDisk * usagePercent;
                        availableGB = envDisk - usedGB;
                      } else {
                        // Close match or no WORKER_DISK_GB - use detected values directly
                        usedGB = usedBytes;
                        availableGB = availBytes;
                      }
                    } else {
                      // No WORKER_DISK_GB - use detected values
                      usedGB = usedBytes;
                      availableGB = availBytes;
                    }
                  }
                }
              }
            }
            
            // If we couldn't get values above, try df directly without checking mounts
            if (usedGB === 0 && availableGB === 0) {
              try {
                // Try df on /host directly
                const dfOutput = execSync('df -BG /host 2>/dev/null || df -BG / 2>/dev/null', { encoding: 'utf8' }).trim();
                const lines = dfOutput.split('\n');
                if (lines.length > 1) {
                  const stats = lines[1].split(/\s+/).filter(s => s.length > 0);
                  if (stats.length >= 4) {
                    const detectedTotal = parseInt(stats[1].replace('G', '')) || 0;
                    const usedBytes = parseInt(stats[2].replace('G', '')) || 0;
                    const availBytes = parseInt(stats[3].replace('G', '')) || 0;
                    
                    if (detectedTotal > 0) {
                      const envDisk = parseInt(workerDisk);
                      if (envDisk && Math.abs(envDisk - detectedTotal) > detectedTotal * 0.2) {
                        // Mac disk vs Docker VM - scale usage percentage
                        const usagePercent = detectedTotal > 0 ? (usedBytes / detectedTotal) : 0;
                        usedGB = envDisk * usagePercent;
                        availableGB = envDisk - usedGB;
                      } else {
                        usedGB = usedBytes;
                        availableGB = availBytes;
                      }
                    }
                  }
                }
              } catch (dfError) {
                // Final fallback: estimate
                const usagePercent = 0.7;
                usedGB = totalGB * usagePercent;
                availableGB = totalGB - usedGB;
              }
            }
          } catch (e) {
            // If we can't read host disk usage, try df directly
            try {
              const dfOutput = execSync('df -BG /host 2>/dev/null || df -BG / 2>/dev/null', { encoding: 'utf8' }).trim();
              const lines = dfOutput.split('\n');
              if (lines.length > 1) {
                const stats = lines[1].split(/\s+/).filter(s => s.length > 0);
                if (stats.length >= 4) {
                  const detectedTotal = parseInt(stats[1].replace('G', '')) || 0;
                  const usedBytes = parseInt(stats[2].replace('G', '')) || 0;
                  const availBytes = parseInt(stats[3].replace('G', '')) || 0;
                  
                  if (detectedTotal > 0) {
                    const envDisk = parseInt(workerDisk);
                    if (envDisk && Math.abs(envDisk - detectedTotal) > detectedTotal * 0.2) {
                      const usagePercent = detectedTotal > 0 ? (usedBytes / detectedTotal) : 0;
                      usedGB = envDisk * usagePercent;
                      availableGB = envDisk - usedGB;
                    } else {
                      usedGB = usedBytes;
                      availableGB = availBytes;
                    }
                  }
                }
              }
            } catch (dfError) {
              // Final fallback: estimate
              const usagePercent = 0.7;
              usedGB = totalGB * usagePercent;
              availableGB = totalGB - usedGB;
            }
          }
          
          return {
            total: Math.round(totalGB),
            available: Math.round(availableGB),
            used: Math.round(usedGB)
          };
        }
      }
      
      // If WORKER_DISK_GB not set, try to read from df anyway
      try {
        const dfOutput = execSync('df -BG /host 2>/dev/null || df -BG / 2>/dev/null', { encoding: 'utf8' }).trim();
        const lines = dfOutput.split('\n');
        if (lines.length > 1) {
          const stats = lines[1].split(/\s+/).filter(s => s.length > 0);
          if (stats.length >= 4) {
            const totalGB = parseInt(stats[1].replace('G', '')) || 0;
            const usedGB = parseInt(stats[2].replace('G', '')) || 0;
            const availGB = parseInt(stats[3].replace('G', '')) || 0;
            
            if (totalGB > 0) {
              return {
                total: totalGB,
                available: availGB,
                used: usedGB
              };
            }
          }
        }
      } catch (e) {
        // Fall through to return null
      }
      
      // Priority 2: Read from /host/sys/block
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
          
          // Get used/available from host's df
          try {
            const dfOutput = execSync('df -BG /host 2>/dev/null || df -BG / 2>/dev/null', { encoding: 'utf8' }).trim();
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
   * Always reads fresh data from host filesystem for real-time updates
   * @returns {Promise<object>} Disk info (total, available, used)
   */
  async getDiskInfo() {
    try {
      // Always use systeminformation for real-time, dynamic readings
      // It reads from container's filesystem which updates frequently
      // Force fresh read by calling fsSize() each time (no caching)
      const fsSize = await si.fsSize();
      
      // Get root filesystem (usually first one or mount === '/')
      const rootFS = fsSize.find(fs => fs.mount === '/') || fsSize[0] || {};
      const containerTotalGB = (rootFS.size || 0) / 1024 / 1024 / 1024;
      const containerUsedGB = (rootFS.used || 0) / 1024 / 1024 / 1024;
      const containerAvailableGB = (rootFS.available || 0) / 1024 / 1024 / 1024;
      
      // Calculate usage percentage from real-time container disk
      const usagePercent = containerTotalGB > 0 ? (containerUsedGB / containerTotalGB) : 0;
      
      // Auto-detect: If WORKER_DISK_GB is set and significantly different, we're on macOS Docker
      // Scale container usage percentage to actual Mac disk for real-time updates
      const workerDisk = process.env.WORKER_DISK_GB;
      if (workerDisk) {
        const envDisk = parseInt(workerDisk);
        if (envDisk && Math.abs(envDisk - containerTotalGB) > containerTotalGB * 0.2) {
          // Mac disk detected - scale container usage percentage to Mac disk
          // Use real-time usage percentage from container filesystem (updates every heartbeat)
          // Keep 2 decimal places for precision so small changes are visible
          const macUsedGB = Math.round((envDisk * usagePercent) * 100) / 100;
          const macAvailableGB = Math.round((envDisk - macUsedGB) * 100) / 100;
          
          return {
            total: envDisk,
            available: macAvailableGB,
            used: macUsedGB
          };
        }
      }
      
      // Use container/host values directly (Linux host or no WORKER_DISK_GB set)
      return {
        total: Math.round(containerTotalGB),
        available: Math.round(containerAvailableGB),
        used: Math.round(containerUsedGB)
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

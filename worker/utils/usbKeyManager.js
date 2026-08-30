const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * USB Key Manager - Handles USB flash drive mounting and master key extraction
 * Works on both macOS and Linux/Ubuntu
 */
class USBKeyManager {
  constructor() {
    // Detect host platform (not container platform)
    // Check if we're in Docker on macOS by looking for /host/dev or checking if diskutil works
    this.platform = this.detectHostPlatform();
    this.mountPoint = '/tmp/aerekos-usb-key';
    this.keyFileName = 'encryption_key';
    this.isMounted = false;
    this.currentDevice = null;
  }

  /**
   * Detect the actual host platform (macOS vs Linux)
   * Even if running in Docker, we need to know the host OS
   * @private
   */
  detectHostPlatform() {
    // Check if we're in Docker on macOS by checking for /Volumes mount
    // macOS Docker Desktop mounts /Volumes into containers
    if (fs.existsSync('/Volumes')) {
      return 'darwin'; // macOS host
    }
    
    // Check if /host/dev exists (Docker with host mounts)
    if (fs.existsSync('/host/dev')) {
      // Try to detect macOS by checking if diskutil would work
      // Since we can't run diskutil in container, check for macOS-specific paths
      if (fs.existsSync('/host/dev/disk')) {
        return 'darwin'; // Likely macOS
      }
    }
    
    // Default to Linux
    return 'linux';
  }

  /**
   * Detect USB flash drives on the system
   * @returns {Promise<Array>} Array of detected USB devices
   */
  async detectUSBDevices() {
    try {
      // Check if we're in Docker and have /host/dev mounted
      const devPath = fs.existsSync('/host/dev') ? '/host/dev' : '/dev';
      
      if (this.platform === 'darwin') {
        // macOS: Check /Volumes for mounted USB drives
        // In Docker on macOS, /Volumes is typically mounted
        const devices = [];
        
        if (fs.existsSync('/Volumes')) {
          const volumes = fs.readdirSync('/Volumes');
          for (const volume of volumes) {
            // Skip system volumes
            if (volume.startsWith('.') || volume === 'Macintosh HD') {
              continue;
            }
            
            const volumePath = `/Volumes/${volume}`;
            try {
              const stats = fs.statSync(volumePath);
              if (stats.isDirectory()) {
                // Check if it's a USB by looking for the encryption_key file
                const keyPath = path.join(volumePath, this.keyFileName);
                if (fs.existsSync(keyPath)) {
                  // Try to find the device path
                  // On macOS, mounted volumes correspond to /dev/disk* devices
                  devices.push({
                    device: `/dev/disk8`, // Will be detected properly
                    volume: volume,
                    mountpoint: volumePath,
                    size: null,
                    type: 'usb',
                    removable: true
                  });
                }
              }
            } catch (error) {
              // Skip volumes we can't access
              continue;
            }
          }
        }
        
        // Also try to use diskutil if available (for native macOS, not Docker)
        try {
          const output = execSync('diskutil list -plist external', { encoding: 'utf8', timeout: 5000, stdio: 'pipe' });
          const diskutilDevices = this.parseMacOSDiskUtil(output);
          devices.push(...diskutilDevices.filter(device => {
            return device.removable && device.size && device.size < 20 * 1024 * 1024 * 1024; // < 20GB
          }));
        } catch (error) {
          // diskutil not available (Docker), that's OK - we use /Volumes method
        }
        
        return devices;
      } else {
        // Linux: Check /dev/sd* and /dev/usb/* devices
        const devices = [];
        
        // Check /dev/sd* devices (or /host/dev/sd* in Docker)
        try {
          const lsblkOutput = execSync('lsblk -d -n -o NAME,SIZE,TYPE,MOUNTPOINT', { encoding: 'utf8', timeout: 5000 });
          const lines = lsblkOutput.split('\n').filter(line => line.trim());
          
          for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length >= 3 && parts[2] === 'disk') {
              const deviceName = `${devPath}/${parts[0]}`;
              // Check if it's a USB device
              const isUSB = await this.isUSBDevice(deviceName, devPath);
              if (isUSB) {
                devices.push({
                  device: deviceName,
                  size: parts[1],
                  type: 'disk',
                  mountpoint: parts[3] || null
                });
              }
            }
          }
        } catch (error) {
          console.warn('[USBKeyManager] lsblk not available, trying alternative method');
        }

        // Also check /dev/usb/* if it exists (or /host/dev/usb/*)
        try {
          const usbPath = `${devPath}/usb`;
          if (fs.existsSync(usbPath)) {
            const usbDevices = fs.readdirSync(usbPath).filter(name => name.match(/^sd[a-z]+$/));
            for (const name of usbDevices) {
              const devicePath = `${usbPath}/${name}`;
              if (fs.existsSync(devicePath)) {
                devices.push({
                  device: devicePath,
                  size: 'unknown',
                  type: 'usb',
                  mountpoint: null
                });
              }
            }
          }
        } catch (error) {
          // /dev/usb doesn't exist, that's OK
        }

        return devices;
      }
    } catch (error) {
      console.error('[USBKeyManager] Error detecting USB devices:', error.message);
      return [];
    }
  }

  /**
   * Parse macOS diskutil plist output
   * @private
   */
  parseMacOSDiskUtil(output) {
    const devices = [];
    // Simple parsing - diskutil list shows devices like:
    // /dev/disk2 (external, physical):
    //    #:                       TYPE NAME                    SIZE       IDENTIFIER
    //    0:      GUID_partition_scheme                        *8.0 GB     disk2
    //    1:                        EFI                         209.7 MB   disk2s1
    //    2:                  Apple_HFS USB Drive                7.7 GB     disk2s2
    
    const lines = output.split('\n');
    let currentDevice = null;
    
    for (const line of lines) {
      if (line.includes('(external, physical)')) {
        const match = line.match(/\/dev\/(disk\d+)/);
        if (match) {
          currentDevice = {
            device: `/dev/${match[1]}`,
            removable: true,
            size: null,
            partitions: []
          };
        }
      } else if (currentDevice && line.includes('GUID_partition_scheme') || line.includes('Apple_HFS')) {
        const sizeMatch = line.match(/(\d+\.?\d*)\s*(GB|MB)/);
        if (sizeMatch) {
          const size = parseFloat(sizeMatch[1]);
          const unit = sizeMatch[2];
          currentDevice.size = unit === 'GB' ? size * 1024 * 1024 * 1024 : size * 1024 * 1024;
        }
        const partitionMatch = line.match(/disk\d+s\d+/);
        if (partitionMatch) {
          currentDevice.partitions.push(`/dev/${partitionMatch[0]}`);
        }
      }
    }
    
    if (currentDevice) {
      devices.push(currentDevice);
    }
    
    return devices;
  }

  /**
   * Check if a device is a USB device (Linux)
   * @private
   */
  async isUSBDevice(devicePath, devPath = '/dev') {
    try {
      // Check /sys/block/<device>/removable (or /host/sys in Docker)
      const deviceName = path.basename(devicePath);
      const sysPath = fs.existsSync('/host/sys') ? '/host/sys' : '/sys';
      const removablePath = `${sysPath}/block/${deviceName}/removable`;
      if (fs.existsSync(removablePath)) {
        const removable = fs.readFileSync(removablePath, 'utf8').trim();
        if (removable === '1') {
          // Also check if it's USB by looking at /sys/block/<device>/device/type
          const typePath = `${sysPath}/block/${deviceName}/device/type`;
          if (fs.existsSync(typePath)) {
            const type = fs.readFileSync(typePath, 'utf8').trim();
            return type === '0' || type === '8'; // USB devices
          }
          return true; // Removable is enough
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Mount USB device
   * @param {string} devicePath - Path to USB device (e.g., /dev/disk2 or /dev/sdb1)
   * @returns {Promise<string>} Mount point path
   */
  async mountUSB(devicePath) {
    try {
      // Ensure mount point exists
      if (!fs.existsSync(this.mountPoint)) {
        fs.mkdirSync(this.mountPoint, { recursive: true });
      }

      // Unmount if already mounted
      if (this.isMounted) {
        await this.unmountUSB();
      }

      let mountCommand;
      if (this.platform === 'darwin') {
        // macOS: Use diskutil mount
        // Find the first partition if device is a whole disk
        let partitionPath = devicePath;
        if (!devicePath.match(/s\d+$/)) {
          // Whole disk, need to find first partition
          const partitions = await this.getPartitions(devicePath);
          if (partitions.length === 0) {
            throw new Error(`No partitions found on ${devicePath}`);
          }
          partitionPath = partitions[0];
        }
        
        mountCommand = `diskutil mount "${partitionPath}"`;
        const output = execSync(mountCommand, { encoding: 'utf8', timeout: 10000 });
        
        // Extract mount point from diskutil output
        const mountMatch = output.match(/mounted at (.+)/);
        if (mountMatch) {
          this.mountPoint = mountMatch[1].trim();
        } else {
          // Try to find mount point using mount command
          const mountOutput = execSync(`mount | grep "${partitionPath}"`, { encoding: 'utf8' });
          const mountLineMatch = mountOutput.match(/on (.+) \(/);
          if (mountLineMatch) {
            this.mountPoint = mountLineMatch[1].trim();
          }
        }
      } else {
        // Linux: Use mount command
        mountCommand = `mount -t auto "${devicePath}" "${this.mountPoint}"`;
        execSync(mountCommand, { encoding: 'utf8', timeout: 10000 });
      }

      this.isMounted = true;
      this.currentDevice = devicePath;
      
      console.log(`[USBKeyManager] USB device mounted at ${this.mountPoint}`);
      return this.mountPoint;
    } catch (error) {
      console.error(`[USBKeyManager] Error mounting USB device ${devicePath}:`, error.message);
      throw new Error(`Failed to mount USB device: ${error.message}`);
    }
  }

  /**
   * Get partitions for a device (macOS)
   * @private
   */
  async getPartitions(devicePath) {
    try {
      const output = execSync(`diskutil list "${devicePath}"`, { encoding: 'utf8', timeout: 5000 });
      const partitions = [];
      const lines = output.split('\n');
      
      for (const line of lines) {
        const match = line.match(/(disk\d+s\d+)/);
        if (match) {
          partitions.push(`/dev/${match[1]}`);
        }
      }
      
      return partitions;
    } catch (error) {
      return [];
    }
  }

  /**
   * Unmount USB device
   * @returns {Promise<void>}
   */
  async unmountUSB() {
    if (!this.isMounted) {
      return;
    }

    try {
      let unmountCommand;
      if (this.platform === 'darwin') {
        // macOS: Use diskutil unmount
        unmountCommand = `diskutil unmount "${this.mountPoint}"`;
      } else {
        // Linux: Use umount
        unmountCommand = `umount "${this.mountPoint}"`;
      }

      execSync(unmountCommand, { encoding: 'utf8', timeout: 10000 });
      
      this.isMounted = false;
      this.currentDevice = null;
      
      console.log(`[USBKeyManager] USB device unmounted from ${this.mountPoint}`);
    } catch (error) {
      console.error(`[USBKeyManager] Error unmounting USB device:`, error.message);
      // Try force unmount
      try {
        if (this.platform === 'darwin') {
          execSync(`diskutil unmount force "${this.mountPoint}"`, { encoding: 'utf8', timeout: 10000 });
        } else {
          execSync(`umount -f "${this.mountPoint}"`, { encoding: 'utf8', timeout: 10000 });
        }
        this.isMounted = false;
        this.currentDevice = null;
      } catch (forceError) {
        throw new Error(`Failed to unmount USB device: ${error.message}`);
      }
    }
  }

  /**
   * Read encryption key from USB device
   * @param {string} [devicePath] - Optional device path (will auto-detect if not provided)
   * @returns {Promise<string>} Master encryption key
   */
  async readEncryptionKey(devicePath = null) {
    try {
      // On macOS Docker, check /Volumes first (already mounted)
      if (this.platform === 'darwin' && fs.existsSync('/Volumes')) {
        const volumes = fs.readdirSync('/Volumes');
        for (const volume of volumes) {
          if (volume.startsWith('.') || volume === 'Macintosh HD') {
            continue;
          }
          
          const volumePath = `/Volumes/${volume}`;
          const keyFilePath = path.join(volumePath, this.keyFileName);
          
          if (fs.existsSync(keyFilePath)) {
            const keyContent = fs.readFileSync(keyFilePath, 'utf8').trim();
            if (keyContent) {
              console.log(`[USBKeyManager] Encryption key read successfully from /Volumes/${volume}`);
              return keyContent;
            }
          }
        }
      }
      
      // If device path provided, mount it first
      if (devicePath) {
        await this.mountUSB(devicePath);
      } else if (!this.isMounted) {
        // Auto-detect and mount first USB device
        const devices = await this.detectUSBDevices();
        if (devices.length === 0) {
          throw new Error('No USB devices detected');
        }
        
        // On macOS, if we have a mountpoint, use it directly
        if (devices[0].mountpoint) {
          const keyFilePath = path.join(devices[0].mountpoint, this.keyFileName);
          if (fs.existsSync(keyFilePath)) {
            const keyContent = fs.readFileSync(keyFilePath, 'utf8').trim();
            if (keyContent) {
              console.log(`[USBKeyManager] Encryption key read successfully from ${devices[0].mountpoint}`);
              return keyContent;
            }
          }
        }
        
        // Otherwise, mount the device
        const deviceToMount = devices[0].partitions?.[0] || devices[0].device;
        await this.mountUSB(deviceToMount);
      }

      // Read encryption_key file
      const keyFilePath = path.join(this.mountPoint, this.keyFileName);
      if (!fs.existsSync(keyFilePath)) {
        await this.unmountUSB();
        throw new Error(`Encryption key file '${this.keyFileName}' not found on USB device`);
      }

      const keyContent = fs.readFileSync(keyFilePath, 'utf8').trim();
      if (!keyContent) {
        await this.unmountUSB();
        throw new Error('Encryption key file is empty');
      }

      // Unmount USB for security
      await this.unmountUSB();

      console.log(`[USBKeyManager] Encryption key read successfully from USB device`);
      return keyContent;
    } catch (error) {
      // Ensure unmount on error
      if (this.isMounted) {
        try {
          await this.unmountUSB();
        } catch (unmountError) {
          // Ignore unmount errors during cleanup
        }
      }
      throw error;
    }
  }

  /**
   * Get current mount status
   * @returns {object} Mount status information
   */
  getStatus() {
    return {
      isMounted: this.isMounted,
      mountPoint: this.isMounted ? this.mountPoint : null,
      currentDevice: this.currentDevice,
      platform: this.platform
    };
  }
}

module.exports = new USBKeyManager();

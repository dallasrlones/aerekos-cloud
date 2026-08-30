const express = require('express');
const router = express.Router();
const usbKeyManager = require('../../utils/usbKeyManager');

/**
 * GET /api/usb/devices
 * List detected USB devices
 */
router.get('/devices', async (req, res) => {
  try {
    const devices = await usbKeyManager.detectUSBDevices();
    res.json({
      success: true,
      devices: devices.map(device => ({
        device: device.device || device.path,
        size: device.size,
        type: device.type,
        mountpoint: device.mountpoint,
        partitions: device.partitions || []
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'USB_DETECTION_ERROR'
      }
    });
  }
});

/**
 * POST /api/usb/detect-key
 * Detect and read encryption key from USB device
 * Body: { devicePath?: string } - Optional device path (auto-detect if not provided)
 */
router.post('/detect-key', async (req, res) => {
  try {
    const { devicePath } = req.body;
    
    const key = await usbKeyManager.readEncryptionKey(devicePath);
    
    res.json({
      success: true,
      message: 'Encryption key detected successfully',
      keyLength: key.length,
      // Don't send the actual key in response for security
      // The key will be passed to key_manager via environment variable
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'USB_KEY_READ_ERROR'
      }
    });
  }
});

/**
 * GET /api/usb/status
 * Get USB mount status
 */
router.get('/status', (req, res) => {
  try {
    const status = usbKeyManager.getStatus();
    res.json({
      success: true,
      status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        code: 'USB_STATUS_ERROR'
      }
    });
  }
});

module.exports = router;

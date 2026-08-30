# USB Master Key Management

## Overview

The aerekos-cloud platform uses a USB flash drive to securely store the master encryption key for `key_manager`. The worker device handles USB mounting/unmounting and passes the key to the `key_manager` container via environment variables.

## Architecture

### Components

1. **USB Key Manager** (`worker/utils/usbKeyManager.js`)
   - Detects USB devices (macOS and Linux)
   - Mounts/unmounts USB drives
   - Reads `encryption_key` file from USB
   - Platform-aware (macOS vs Linux)

2. **Worker API** (`worker/api/routes/usb.js`)
   - `GET /api/usb/devices` - List detected USB devices
   - `POST /api/usb/detect-key` - Manually detect and read encryption key
   - `GET /api/usb/status` - Get USB mount status

3. **Deployment Handler Integration**
   - Automatically reads USB key when deploying `key_manager`
   - Passes key via `MASTER_KEY` environment variable
   - Falls back gracefully if USB not available (dev mode)

## USB Drive Setup

### Requirements

- **Size**: 8GB flash drive (or similar)
- **File**: `encryption_key` file in root directory
- **Format**: Plain text file containing the master key (64 hex characters for 256-bit key)

### Example Key Format

```
a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890
```

## How It Works

### Automatic Mode (On Service Start)

1. **Worker detects** `key_manager` needs to be deployed
2. **Worker calls** `usbKeyManager.readEncryptionKey()`
3. **USB Manager**:
   - Detects USB devices
   - Mounts first USB device found
   - Reads `encryption_key` file
   - Unmounts USB drive (for security)
4. **Deployment Handler** adds `MASTER_KEY` to container environment
5. **Container starts** with `MASTER_KEY` already set

### Manual Mode (Detect Key Button)

1. **User clicks** "Detect Key" button in UI
2. **Frontend calls** `POST /api/usb/detect-key` (via conductor proxy)
3. **Worker**:
   - Detects USB devices
   - Mounts USB drive
   - Reads `encryption_key` file
   - Unmounts USB drive
4. **Response** confirms key was read (key not sent in response for security)
5. **If key_manager is running**: Restart container with new key
6. **If key_manager is not running**: Next deployment will use the key

## Platform Support

### macOS

- Uses `diskutil` for device detection and mounting
- Detects external disks via `diskutil list external`
- Mounts partitions automatically
- Unmounts using `diskutil unmount`

### Linux/Ubuntu

- Uses `lsblk` for device detection
- Checks `/sys/block/*/removable` to identify USB devices
- Mounts using standard `mount` command
- Unmounts using `umount`

## Security Considerations

1. **USB Unmounting**: USB is automatically unmounted after reading key
2. **Key Not Logged**: Master key is never logged or exposed in API responses
3. **Environment Variable**: Key passed securely via container environment
4. **No Persistent Storage**: Key not stored on disk, only in container memory
5. **Dev Fallback**: Development mode uses default key if USB not available

## API Endpoints

### List USB Devices

```bash
GET /api/usb/devices

Response:
{
  "success": true,
  "devices": [
    {
      "device": "/dev/disk2",
      "size": "8.0 GB",
      "type": "disk",
      "mountpoint": null,
      "partitions": ["/dev/disk2s1", "/dev/disk2s2"]
    }
  ]
}
```

### Detect Key

```bash
POST /api/usb/detect-key
Content-Type: application/json

{
  "devicePath": "/dev/disk2"  // Optional, auto-detect if not provided
}

Response:
{
  "success": true,
  "message": "Encryption key detected successfully",
  "keyLength": 64
}
```

### Get Status

```bash
GET /api/usb/status

Response:
{
  "success": true,
  "status": {
    "isMounted": false,
    "mountPoint": null,
    "currentDevice": null,
    "platform": "darwin"
  }
}
```

## Error Handling

- **No USB Device**: Falls back to `MASTER_KEY` environment variable or dev key
- **Mount Failure**: Logs error, continues with fallback
- **Key File Missing**: Throws error, deployment fails (unless dev mode)
- **Unmount Failure**: Attempts force unmount, logs warning

## Development Mode

If USB device is not available:
- Worker logs warning
- `key_manager` uses `MASTER_KEY` from environment (if set)
- Falls back to `dev-master-key-change-in-production` if not set
- Service still starts (for development/testing)

## Production Deployment

### Docker Setup

The worker container needs access to USB devices. The `docker-compose.yml` includes:
- `/dev:/dev:rw` device mount (allows USB access)
- On macOS: USB devices accessible via `/dev/disk*`
- On Linux: USB devices accessible via `/dev/sd*` or `/dev/usb/*`

### Deployment Steps

1. **Plug USB drive** into worker device
2. **Ensure** `encryption_key` file exists on USB root directory
3. **Start worker** container (with USB device access)
4. **Deploy** `key_manager` service (worker will auto-detect USB and read key)
5. **Verify** key loaded: Check `key_manager` logs for "MASTER_KEY loaded from environment"
6. **Remove USB** after deployment (for security)

### Manual Key Detection

If you need to manually detect the key (e.g., USB plugged in after worker started):

```bash
# Via worker API (if accessible)
curl -X POST http://localhost:3001/api/usb/detect-key

# Or via conductor proxy (from frontend)
# POST /api/workers/:workerId/usb/detect-key
```

## Troubleshooting

### USB Not Detected

- Check USB drive is plugged in
- Verify drive is formatted (FAT32, exFAT, or HFS+)
- Check permissions: Worker needs access to `/dev/*` devices
- On macOS: Check `diskutil list external`
- On Linux: Check `lsblk` or `/sys/block/`

### Mount Failed

- Check USB drive is not already mounted elsewhere
- Verify file system is supported
- Check worker has mount permissions
- Try manually mounting: `mount /dev/sdb1 /tmp/test`

### Key File Not Found

- Verify file is named exactly `encryption_key` (not `master.key` or `encryption_key.txt`)
- Check file is in root directory of USB drive
- Verify file has read permissions
- Check file is not empty

### Container Still Fails

- Check `key_manager` logs: `docker logs aerekos-docunu-dev-key_manager`
- Verify `MASTER_KEY` is in container environment: `docker exec aerekos-docunu-dev-key_manager env | grep MASTER_KEY`
- Check worker logs for USB detection errors
- Try manual key detection via API

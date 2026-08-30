# Key Manager Service (KMS)

Enterprise-grade key management service for aerekos-cloud. Provides secure key storage, encryption, and lifecycle management with master key encryption from USB flash drive.

## Overview

The Key Manager Service (KMS) is a foundational service that provides encryption key management across the aerekos-cloud platform. It handles:

- **Master Key Encryption**: All keys encrypted with master key from USB flash drive
- **Key Lifecycle Management**: Create, rotate, archive, delete keys
- **Key Versioning**: Support multiple versions of keys for rotation
- **Service-to-Service Authentication**: Authentication via conductor tokens
- **High Availability**: Can be deployed across multiple workers

## Features

- ✅ Master key encryption from USB flash drive (with dev fallback)
- ✅ Key lifecycle management (create, rotate, archive, delete)
- ✅ Key versioning support
- ✅ Service-to-service authentication via conductor
- ✅ SQLite database for key storage
- ✅ Health checks (including master key check)
- ✅ Auto-registration with conductor
- ✅ Comprehensive API for key operations

## Architecture

### Service Dependencies

- **Conductor**: Service registration, routing, authentication
- **SQLite**: Direct database connection (local, small database)
- **USB Flash Drive**: Provides master key for encryption (production)

### Service Consumers

- **storage_manager**: Requests encryption keys for object encryption
- **All services**: Can request keys for encrypting sensitive data

## Setup

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- USB flash drive with `master.key` file (production)
- Conductor service running

### Installation

1. **Clone and navigate to the service**:
   ```bash
   cd worker/key_manager
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment**:
   ```bash
   cp .env_example .env
   # Edit .env with your configuration
   ```

4. **Start the service**:
   ```bash
   npm start
   # Or for development:
   npm run dev
   ```

### Docker Setup

```bash
# Build and start
docker-compose up --build

# Or run in background
docker-compose up -d
```

### USB Flash Drive Setup (Production)

1. Create a USB flash drive with a `master.key` file
2. The master key should be a 64-character hex string (256 bits)
3. Example: `a1b2c3d4e5f6789012345678901234567890123456789012345678901234567890`
4. Mount the USB device in Docker (see `docker-compose.yml`)

**Development Mode**: If no USB device is detected, the service will:
- Use `MASTER_KEY` from environment variable, OR
- Use default dev key: `dev-master-key-change-in-production`

## Configuration

### Environment Variables

See `.env_example` for all configuration options:

- `SERVICE_NAME`: Service name (default: `key_manager`)
- `SERVICE_VERSION`: Service version (default: `1.0.0`)
- `PORT`: Service port (default: `3002`)
- `CONDUCTOR_URL`: Conductor service URL
- `MASTER_KEY`: Master key (set by entrypoint script from USB)
- `DATABASE_PATH`: SQLite database path
- `LOG_LEVEL`: Logging level (default: `info`)

## API Usage

### Getting an Encryption Key

```javascript
const axios = require('axios');

async function getEncryptionKey(keyName) {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  const response = await axios.get(
    `${conductorUrl}/api/services/key_manager/api/keys/${keyName}`,
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data.key_material; // Use this for encryption
}
```

### Creating a New Key

```javascript
async function createEncryptionKey(keyName) {
  const response = await axios.post(
    `${conductorUrl}/api/services/key_manager/api/keys`,
    {
      name: keyName,
      type: 'symmetric',
      algorithm: 'AES-256-GCM',
      metadata: {
        description: 'Encryption key for storage',
        service: 'storage_manager'
      }
    },
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  return response.data;
}
```

### Rotating a Key

```javascript
async function rotateEncryptionKey(keyName) {
  const response = await axios.post(
    `${conductorUrl}/api/services/key_manager/api/keys/${keyName}/rotate`,
    {},
    {
      headers: {
        'Authorization': `Bearer ${serviceToken}`,
        'Content-Type': 'application/json'
      }
    }
  );
  
  // New version is created, old version marked inactive
  return response.data;
}
```

### Operations: master key vs data key rotation

- **Data key rotation (normal ops):** Use `POST …/keys/:name/rotate` (via the conductor proxy: `POST /api/services/key_manager/api/keys/:name/rotate` with `project_id` as for other calls). Consumers like `storage_manager` should read the **current** key version for new data; re-encrypting old blobs is a **background job** in the owning service if you need strict version cutover.
- **Master key (KMS root):** Changing `MASTER_KEY` / the USB `master.key` invalidates decryption of all **stored** ciphertext in the key_manager DB unless you **re-wrap** key material with the new master. Plan a **maintenance window**: backup the SQLite DB, deploy the new master, run a one-off re-encrypt script (or restore from a backup taken before the change). There is no single API for this; treat it like a **KMS re-key** project.
- **Conductor path:** All calls from other services go through the conductor, e.g. `GET /api/services/key_manager/api/keys/:name?project_id=…` with the service’s JWT or service token, as in the examples above.
- **Production:** Prefer USB (or a mounted secret) for the master key; keep **dev** defaults out of `NODE_ENV=production`.

## API Endpoints

### Key Management

- `POST /api/keys` - Create new key
- `GET /api/keys` - List all keys (with filtering)
- `GET /api/keys/:name` - Get key by name (latest version)
- `GET /api/keys/:name/versions` - Get all versions of a key
- `GET /api/keys/:name/:version` - Get specific key version
- `POST /api/keys/:name/rotate` - Rotate key
- `DELETE /api/keys/:name` - Delete key (all versions)
- `DELETE /api/keys/:name/:version` - Delete specific version
- `POST /api/keys/:name/archive` - Archive key

### Health & Monitoring

- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe (checks master key)
- `GET /metrics` - Service metrics

See `api/openapi.yaml` for complete API documentation.

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Master Key Format

- **Format**: Hex string (64 characters for 256-bit key)
- **Example**: `a1b2c3d4e5f6...` (32 bytes = 64 hex chars)
- **Storage**: Never log or expose the master key
- **Dev Fallback**: Use `dev-master-key-change-in-production` if USB not available

## Security Considerations

1. **Master Key**: Never log or expose the master key
2. **USB Flash Drive**: Unmount USB after reading master key
3. **Key Material**: Only return decrypted key material to authenticated services
4. **Service Tokens**: All API endpoints require service token authentication
5. **Encryption**: All keys stored in database are encrypted with master key

## Development Notes

### Service Registration

The service auto-registers with conductor on startup. If the conductor service registration endpoint (`POST /api/services/register`) doesn't exist yet, the service will:
- Log a warning
- Continue running (for development)
- Other services can stub key_manager calls during development

### Database

This service uses SQLite directly (small, local database). Other services use `db_manager` to create databases, but key_manager uses SQLite for simplicity and performance.

## Troubleshooting

### Master Key Not Loaded

- Check USB device is mounted correctly
- Verify `master.key` file exists on USB
- Check entrypoint script logs
- Fallback to `MASTER_KEY` environment variable

### Service Registration Fails

- Check conductor is running
- Verify `CONDUCTOR_URL` is correct
- Check network connectivity
- Service will continue running even if registration fails (dev mode)

### Database Errors

- Check `DATABASE_PATH` is writable
- Verify data directory exists
- Check disk space
- Review database file permissions

## License

ISC

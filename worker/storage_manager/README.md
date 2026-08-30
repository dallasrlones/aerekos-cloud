# Storage Manager Service

S3-compatible object storage service for aerekos-cloud with automatic encryption, chunked uploads, and signed URLs.

## Overview

Storage Manager provides a hierarchical object storage system: **Projects → Buckets → Files**. Every file is automatically encrypted using keys from the key_manager service, and the service supports massive file uploads via chunked/multipart uploads.

## Features

- **Project-based organization**: Projects contain buckets, buckets contain files
- **Automatic encryption**: Every file is encrypted using keys from key_manager
- **Chunked uploads**: Support for large file uploads via multipart/chunked uploads
- **Massive file support**: Handle files of any size efficiently
- **Signed URLs**: Generate time-limited signed URLs for upload/download with TTLs
- **S3-Compatible API**: Follows S3 API patterns for easy integration

### Host devices & performance *(planned)*

Aerekos storage should understand **where data physically lives** on worker machines, not only the logical `STORAGE_PATH`:

- **Drive detection**: Discover attached block devices and mount points (capacity, filesystem, mount path, removable vs fixed where the OS exposes it).
- **Drive speed**: Report or measure **throughput** (e.g. sequential read/write MB/s or a short bounded benchmark) so the control plane and operators can compare tiers (NVMe vs SATA vs USB) and place buckets or cache policies appropriately.

Details, API sketches, and platform notes live in **`plan.md`** → *Host drives, devices & performance*.

## Architecture

### Hierarchy
- **Projects**: Top-level containers
- **Buckets**: Belong to projects, contain files
- **Files**: Belong to buckets, automatically encrypted

### Service Dependencies
- **Conductor**: Service registration, routing, authentication
- **key_manager**: Encryption keys (can be stubbed during development)
- **db_manager**: Database for metadata (falls back to SQLite if not available)

## Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose (optional)

### Installation

1. Copy `.env_example` to `.env`:
   ```bash
   cp .env_example .env
   ```

2. Update environment variables in `.env`

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the service:
   ```bash
   npm start
   ```

### Docker

```bash
docker-compose up --build
```

## Configuration

See `.env_example` for all configuration options. Key variables:

- `SERVICE_NAME`: Service name (default: `storage_manager`)
- `PORT`: Service port (default: `3003`, auto-detected if in use)
- `CONDUCTOR_URL`: Conductor API URL
- `STORAGE_PATH`: Storage root directory (default: `./storage`)
- `MOCK_KEY_MANAGER`: Set to `true` for local dev only (encryption uses `MOCK_KEY_MATERIAL` or a default hex string). **Forbidden** when `NODE_ENV=production` (process exits). Production must use real `key_manager` via conductor.
- `DATABASE_PATH`: SQLite database path (default: `./data/storage_manager.db`)

## API Documentation

See `api/openapi.yaml` for full API documentation.

### Quick Examples

#### Create a Project
```bash
curl -X POST http://localhost:3003/api/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-project"}'
```

#### Create a Bucket
```bash
curl -X POST http://localhost:3003/api/projects/PROJECT_ID/buckets \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "my-bucket"}'
```

#### Upload a File
```bash
curl -X POST http://localhost:3003/api/projects/PROJECT_ID/buckets/BUCKET_NAME/files/path/to/file.txt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/local/file.txt"
```

#### Download a File
```bash
curl -X GET http://localhost:3003/api/projects/PROJECT_ID/buckets/BUCKET_NAME/files/path/to/file.txt \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o downloaded_file.txt
```

## Development

### Parallel Development with key_manager

During parallel development, the service uses stubbed key_manager calls. Set `MOCK_KEY_MANAGER=true` in `.env` to enable this mode.

When key_manager is ready, remove `MOCK_KEY_MANAGER` or set it to `false`, and the service will use real key_manager API calls.

### Database

The service uses SQLite by default for development. In production, it will attempt to use db_manager to create a PostgreSQL database. If db_manager is not available, it falls back to SQLite.

## Testing

Comprehensive test suite covering unit tests, integration tests, and end-to-end tests.

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

See `tests/README.md` for detailed testing documentation and `plan.md` Phase 6 for complete test case list.

## Health Checks

- `GET /health` - Liveness probe
- `GET /ready` - Readiness probe
- `GET /metrics` - Service metrics

## Project Structure

```
storage_manager/
├── api/
│   ├── routes/          # Express routes
│   ├── services/         # Business logic
│   ├── repos/           # Data access
│   ├── middleware/      # Express middleware
│   ├── utils/           # Utilities
│   └── models/          # Database models
├── storage/             # Object storage (gitignored)
├── data/                # SQLite database (gitignored)
├── index.js             # Main entry point
└── package.json
```

## Integration with Other Services

See `plan.md` for examples of how other services can use storage_manager.

## License

ISC

# aerekos-cloud Conductor

The conductor is the master orchestrator for aerekos-cloud. It manages all workers, services, authentication, and provides the primary API for third-party applications.

## Status

✅ **All backend phases complete!** All 76 tests passing.
✅ **Frontend complete!** Dashboard, Settings, Devices management, and URL routing.

- ✅ Phase 1: Initial Setup & Configuration
- ✅ Phase 2: Database Setup
- ✅ Phase 3: Authentication Foundation
- ✅ Phase 4: Authentication Endpoints & Middleware
- ✅ Phase 5: Conductor Token Generation
- ✅ Phase 6: Health Check & Basic API
- ⏳ Phase 7: Frontend Setup (Ready for implementation)
- ✅ Phase 8: Testing (All 48 tests passing)

## Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Docker and Docker Compose (for containerized deployment)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Copy environment file:
```bash
cp .env_example .env
```

3. Update `.env` with your configuration (especially `JWT_SECRET` and `TOKEN_SECRET`)

4. Start the server:
```bash
npm start
```

Or for development (with auto-restart on code changes):
```bash
npm run dev
```

**Note**: The `dev` script uses `nodemon` to automatically restart the server when code changes are detected in the `api/` directory, `index.js`, or `scripts/` directory. See `nodemon.json` for configuration details.

### Docker

Build and run with Docker Compose (development mode with nodemon auto-restart):
```bash
docker-compose up --build
```

**Note**: The Docker Compose setup uses `Dockerfile.dev` which runs nodemon for automatic server restarts when code changes are detected. Code changes in `api/`, `index.js`, or `scripts/` will automatically restart the server.

For production, use the production Dockerfile:
```bash
docker-compose -f docker-compose.yml build --build-arg DOCKERFILE=Dockerfile
```

## API Endpoints

### Health Check
- `GET /health` - Health check endpoint

### Authentication
- `POST /api/auth/login` - Login with username and password
- `GET /api/auth/me` - Get current user (requires auth)
- `POST /api/auth/logout` - Logout (requires auth)

### Registration Tokens
- `GET /api/token` - Get current registration token (requires auth)
- `POST /api/token/regenerate` - Regenerate registration token (requires auth)

### Worker Management
- `POST /api/workers/register` - Register a worker (requires registration token)
- `POST /api/workers/:id/heartbeat` - Worker heartbeat
- `PUT /api/workers/:id/resources` - Update worker resources
- `GET /api/workers` - List all workers (requires auth)
- `GET /api/workers/:id` - Get worker details (requires auth)

### API Versioning
All endpoints are available at both:
- `/api/v1/*` - Versioned endpoints
- `/api/*` - Legacy endpoints (for backward compatibility)

## Testing

Run all tests:
```bash
npm test
```

Run with coverage:
```bash
npm run test:coverage
```

Run specific test suite:
```bash
npm run test:integration
```

## Project Structure

```
conductor/
├── api/
│   ├── middleware/     # Express middleware (auth, requestId)
│   ├── models/         # Database models
│   ├── repos/          # Repository layer (data access)
│   ├── routes/         # API routes
│   ├── services/       # Business logic layer
│   │   └── aerekos-record/  # Local copy of aerekos-record ORM
│   └── utils/          # Utility functions
├── data/               # SQLite database storage
├── scripts/            # Utility scripts (seedUsers)
├── tests/              # Test files
│   ├── helpers/        # Test helpers
│   └── integration/    # Integration tests
├── index.js            # Main server file
├── docker-compose.yml  # Docker Compose configuration
├── Dockerfile          # Docker image definition
└── package.json        # Dependencies and scripts
```

## Environment Variables

See `.env_example` for all available environment variables.

Key variables:
- `PORT` - Server port (default: 3000)
- `DATABASE_PATH` - SQLite database path
- `JWT_SECRET` - Secret for JWT token signing
- `JWT_EXPIRES_IN` - JWT expiration time
- `NODE_ENV` - Environment (development/production/test)

## Default User

In development mode, if no users exist, an admin user is automatically seeded:
- Username: `admin`
- Password: `admin123` (change this!)

**Important**: Change the default password in production!

## Next Steps

1. **Frontend**: Implement React Native frontend (Phase 7)
2. **Worker Setup**: Move to `worker/plan.md` for worker implementation
3. **Services**: Implement individual services from main `plan.md`

## Documentation

- [Main Plan](../plan.md) - High-level roadmap
- [Backend Guidelines](../backend_guidelines.md) - Coding standards
- [Frontend Guidelines](../frontend_guidelines.md) - Frontend standards
- [Testing Guidelines](../testing_guidelines.md) - Testing standards

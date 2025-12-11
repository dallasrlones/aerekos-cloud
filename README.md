# aerekos-cloud

A local AWS-like cloud infrastructure platform that orchestrates distributed services across multiple worker devices using a conductor-worker architecture.

## Overview

aerekos-cloud provides a self-hosted, containerized cloud platform where:
- **Conductor** acts as the master orchestrator, managing all workers and services
- **Workers** are slave devices that host and run services
- **Services** are containerized applications that can be dynamically deployed across workers
- Everything runs locally using Docker and Docker Compose

## Architecture

### Components

#### Conductor
The conductor is the central control plane of aerekos-cloud:
- **Primary API**: Serves as the main API endpoint for all third-party applications
- **Worker Management**: Handles worker registration, discovery, and health monitoring
- **Service Orchestration**: Manages service lifecycle, deployment, and routing
- **Resource Management**: Tracks and allocates resources across workers
- **Frontend**: React Native dashboard for managing the entire infrastructure
- **Database**: Uses SQLite (via `aerekos-record`) to store all state

#### Workers
Workers are devices that host and run services:
- **Self-Registration**: Automatically register with conductor using token and IP
- **Resource Reporting**: Report available resources (CPU, RAM, disk, network)
- **Container Execution**: Run Docker containers as instructed by conductor
- **Heartbeat**: Maintain connection with conductor via periodic heartbeats
- **Resilience**: Automatically re-register after power outages or IP changes

#### Services
Services are the applications provided by aerekos-cloud:
- **Modular**: Each service lives in its own folder under `worker/`
- **Containerized**: Each service has its own `docker-compose.yml`
- **API-enabled**: Each service exposes its own API
- **Orchestrated**: Services communicate with conductor for coordination
- **Dynamic**: Can be enabled/disabled and deployed across workers on demand

### Data Flow

```
Third-Party Apps → Conductor API → Service APIs → Workers → Docker Containers
                                    ↓
                              SQLite Database
```

1. Third-party applications make requests to the Conductor API
2. Conductor routes requests to appropriate service APIs
3. Service APIs communicate with conductor for coordination
4. Conductor orchestrates deployment and manages workers
5. Workers execute Docker containers for services

## Features

- 🎯 **Self-Hosted**: Complete local control over your infrastructure
- 🔄 **Dynamic Orchestration**: Automatically deploy services to optimal workers
- 📊 **Resource Management**: Intelligent worker selection based on available resources
- 🔌 **Self-Registration**: Workers automatically register and recover from failures
- 🐳 **Docker-Native**: Everything runs in containers for easy deployment
- 📱 **React Native Dashboard**: Manage everything from a mobile-friendly interface
- 🔐 **Token-Based Security**: Secure worker registration and communication
- 📈 **Scalable**: Add workers dynamically to scale your infrastructure

## Project Structure

```
aerekos-cloud/
├── conductor/             # Conductor service (master)
│   ├── index.js          # Conductor API server
│   ├── docker-compose.yml # Conductor + Frontend docker-compose
│   ├── Dockerfile.dev     # Development Dockerfile
│   └── .env_example       # Conductor environment variables
├── worker/                # Worker (slave)
│   ├── index.js          # Worker registration client
│   ├── docker-compose.yml # Primary worker container docker-compose
│   ├── Dockerfile.dev     # Development Dockerfile
│   ├── .env_example       # Worker environment variables
│   └── [service_name]/   # Individual services (each has own docker-compose.yml)
│       ├── docker-compose.yml # Service-specific docker-compose
│       └── ...
├── services/              # Shared services
│   └── aerekos-record/   # SQLite ORM
├── aerekos-sdk/          # SDK for third-party integrations
├── README.md             # This file
├── DOCKER.md             # Docker setup guide
├── TESTING.md            # Testing guide
└── plan.md               # Implementation plan
```

## Quick Start (Docker Compose - Recommended)

### Prerequisites

- Docker and Docker Compose
- Network access for ports 3000, 3001, 19006

### Complete Setup (All Services)

1. **Clone and setup**
   ```bash
   cd aerekos-cloud
   cp .env_example .env
   
   # Setup conductor .env
   cd conductor
   cp .env_example .env
   # Edit .env with JWT_SECRET
   cd ..
   ```

2. **Start conductor and frontend**
   ```bash
   docker-compose up --build
   ```

3. **Get registration token**
   - Open http://localhost:19006 in browser
   - Login: `admin` / `admin`
   - Go to Settings → View registration token
   - Copy token

4. **Configure and start worker**
   ```bash
   # Add WORKER_TOKEN=<your-token> to root .env
   # Then start worker
   docker-compose up -d worker
   ```

5. **Verify registration**
   - Check http://localhost:19006/devices
   - Worker should appear with status "online"

**All services are now running:**
- Conductor API: http://localhost:3000
- Frontend: http://localhost:19006
- Worker API: http://localhost:3001

See [DOCKER.md](./DOCKER.md) for detailed Docker setup instructions.

### Alternative: Local Development

If you prefer to run services locally (without Docker):

**Conductor:**
```bash
cd conductor
npm install
cp .env_example .env
npm start
```

**Worker:**
```bash
cd worker
npm install
cp .env_example .env
# Edit .env with CONDUCTOR_URL and CONDUCTOR_TOKEN
npm start
```

### Service Management

1. **List available services**
   ```bash
   curl http://localhost:3000/api/services
   ```

2. **Enable a service**
   ```bash
   curl -X POST http://localhost:3000/api/services/ai_manager/enable
   ```

3. **View service deployments**
   ```bash
   curl http://localhost:3000/api/services/ai_manager/deployments
   ```

## API Endpoints

### Conductor API

#### Worker Management
- `GET /api/workers` - List all workers
- `GET /api/workers/:id` - Get worker details
- `POST /api/workers/register` - Register a new worker
- `POST /api/workers/:id/heartbeat` - Worker heartbeat
- `GET /api/resources` - Get aggregated resource information

#### Service Management
- `GET /api/services` - List all services
- `GET /api/services/:name` - Get service details
- `POST /api/services/:name/enable` - Enable a service
- `POST /api/services/:name/disable` - Disable a service
- `GET /api/services/:name/deployments` - Get service deployments
- `POST /api/services/:name/deploy` - Deploy service to workers

#### Authentication
- `POST /api/auth/login` - User login (username, password) - returns JWT token
- `GET /api/auth/me` - Get current user info (requires JWT authentication)

#### Token Management
- `GET /api/token` - Get current registration token (requires authentication)
- `POST /api/token/regenerate` - Generate new token (requires authentication)

### Service APIs

Each service exposes its own API endpoints. The conductor routes requests to services based on the service name and path.

#### Key Manager (KMS)
- `POST /api/key_manager/keys` - Create new encryption key
- `GET /api/key_manager/keys/:id` - Get key details
- `POST /api/key_manager/keys/:id/rotate` - Rotate key
- `POST /api/key_manager/keys/:id/encrypt` - Encrypt data
- `POST /api/key_manager/keys/:id/decrypt` - Decrypt data

#### Storage Manager (S3-like)
- `POST /api/storage_manager/buckets` - Create bucket
- `GET /api/storage_manager/buckets` - List buckets
- `DELETE /api/storage_manager/buckets/:name` - Delete bucket
- `POST /api/storage_manager/buckets/:name/objects` - Upload object
- `GET /api/storage_manager/buckets/:name/objects/:key` - Download object
- `DELETE /api/storage_manager/buckets/:name/objects/:key` - Delete object
- `GET /api/storage_manager/buckets/:name/objects` - List objects

#### Other Services
Example:
```
GET /api/ai_manager/models          → Routes to ai_manager service
GET /api/auth_manager/users         → Routes to auth_manager service
```

## Database Models

The conductor uses SQLite (via `aerekos-record`) with the following models:

- **User**: Stores user credentials (username, password_hash, email, role) - seeded only, no registration
- **Worker**: Stores worker device information
- **Service**: Stores service definitions and configuration
- **ServiceDeployment**: Tracks service deployments across workers
- **Token**: Manages conductor registration tokens
- **Resource**: Tracks worker resource availability

## Authentication

- **User Login**: `POST /api/auth/login` - Authenticate with username/password, returns JWT token
- **Current User**: `GET /api/auth/me` - Get current authenticated user (requires JWT)
- **No Registration**: Users are seeded only, no public registration endpoint
- **JWT Tokens**: All authenticated requests require JWT token in Authorization header
- **Password Security**: Passwords are hashed using bcrypt before storage

## Coding Standards

### Backend Architecture

Follow a **service/repository pattern** with clear separation of concerns:

```
conductor/
├── services/          # Business logic layer
│   ├── UserService.js
│   ├── WorkerService.js
│   └── ServiceService.js
├── repos/             # Data access layer
│   ├── UserRepository.js
│   ├── WorkerRepository.js
│   └── ServiceRepository.js
├── routes/            # API routes (thin controllers)
│   ├── auth.js
│   ├── workers.js
│   └── services.js
├── middleware/        # Express middleware
│   ├── auth.js       # JWT authentication
│   └── errorHandler.js
└── utils/             # Utility functions
```

**Principles:**
- **DRY (Don't Repeat Yourself)**: Extract common functionality into services/utils
- **Separation of Concerns**: Routes handle HTTP, services handle business logic, repos handle data
- **Single Responsibility**: Each class/function should do one thing well
- **Dependency Injection**: Services depend on repositories, not direct database access

**Example Service Structure:**
```javascript
// services/UserService.js
class UserService {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }
  
  async authenticate(username, password) {
    // Business logic here
  }
}

// repos/UserRepository.js
class UserRepository {
  async findByUsername(username) {
    // Database operations here
  }
}
```

### Frontend Architecture (React Native)

Organize code into clear, reusable modules:

```
screens/               # Screen components
components/            # Reusable UI components
├── Button/
│   ├── Button.jsx
│   └── Button.styles.js
├── Card/
│   ├── Card.jsx
│   └── Card.styles.js
hooks/                 # Custom React hooks
├── useAuth.js
├── useWorkers.js
└── useServices.js
styles/                # Global styles and themes
├── colors.js
├── typography.js
└── spacing.js
utils/                 # Utility functions
├── api.js            # API client
├── validation.js
└── helpers.js
```

**Principles:**
- **Component Separation**: Keep components small and focused
- **Style Separation**: Styles in separate files (`.styles.js` or `styles/` folder)
- **Custom Hooks**: Extract reusable logic into hooks
- **DRY**: Don't repeat component logic, extract to hooks/utils
- **Consistent Structure**: Follow the same folder structure across screens/components

**Example Component Structure:**
```javascript
// components/Button/Button.jsx
import { ButtonStyles } from './Button.styles';

export const Button = ({ title, onPress }) => {
  return (
    <TouchableOpacity style={ButtonStyles.container} onPress={onPress}>
      <Text style={ButtonStyles.text}>{title}</Text>
    </TouchableOpacity>
  );
};

// components/Button/Button.styles.js
export const ButtonStyles = StyleSheet.create({
  container: { ... },
  text: { ... }
});
```

### Environment Files

**Every service must have:**
- `.env` - Actual environment variables (gitignored)
- `.env_example` - Template with all required variables (committed)

**Example .env_example:**
```bash
PORT=3000
DATABASE_PATH=./data/conductor.db
JWT_SECRET=your-secret-key-here
CONDUCTOR_URL=http://conductor:3000
```

## Development

### Adding a New Service

1. **Create service folder**
   ```bash
   mkdir -p worker/my_service
   ```

2. **Create .env_example**
   ```bash
   PORT=3001
   CONDUCTOR_URL=http://conductor:3000
   DATABASE_PATH=./data/my_service.db
   ```

3. **Create docker-compose.yml**
   ```yaml
   version: '3.8'
   services:
     my_service:
       image: my_service:latest
       ports:
         - "3001:3000"
       env_file:
         - .env
       environment:
         - CONDUCTOR_URL=http://conductor:3000
   ```

4. **Implement service API following standards**
   - Create `services/` folder for business logic
   - Create `repos/` folder for database operations
   - Create `routes/` folder for API endpoints
   - Keep code DRY, follow service/repo pattern
   - Service should register with conductor on startup
   - Expose API endpoints as needed
   - Report health status to conductor

5. **Add integration tests**
   - Test service endpoints
   - Test service-to-conductor communication
   - Test error handling

6. **Enable service**
   - Use conductor API or dashboard to enable the service
   - Conductor will deploy it to appropriate workers

### Local Development

1. **Start conductor in development mode**
   ```bash
   cd conductor
   npm install
   npm run dev
   ```

2. **Start worker in development mode**
   ```bash
   cd worker
   npm install
   npm run dev
   ```

## Configuration

### Environment Variables

#### Conductor
- `PORT` - API server port (default: 3000)
- `DATABASE_PATH` - SQLite database path (default: ./data/conductor.db)
- `TOKEN_SECRET` - Secret for token generation
- `JWT_SECRET` - Secret for JWT token signing
- `JWT_EXPIRES_IN` - JWT token expiration time (default: 24h)

#### Worker
- `CONDUCTOR_TOKEN` - Registration token from conductor
- `CONDUCTOR_IP` - IP address of conductor
- `CONDUCTOR_PORT` - Port of conductor API (default: 3000)
- `HEARTBEAT_INTERVAL` - Heartbeat interval in seconds (default: 30)

#### Services (key_manager, storage_manager, etc.)
- `PORT` - Service API port
- `CONDUCTOR_URL` - URL of conductor API
- `DATABASE_PATH` - SQLite database path for service
- Service-specific variables as needed

**Note**: Every service must have both `.env` and `.env_example` files. Copy `.env_example` to `.env` and fill in actual values.

## Troubleshooting

### Worker Not Registering
- Verify `CONDUCTOR_TOKEN` and `CONDUCTOR_IP` are set correctly
- Check network connectivity between worker and conductor
- Review conductor logs for registration errors

### Service Not Deploying
- Check worker resources are sufficient
- Verify service docker-compose.yml is valid
- Review conductor logs for deployment errors

### Database Issues
- Ensure SQLite database file has proper permissions
- Check database file path is correct
- Review database logs for errors

## Testing

### Unit Tests
- Test individual services and repositories
- Test utility functions and helpers
- Mock dependencies appropriately

### Integration Tests
- Test API endpoints end-to-end
- Test service-to-conductor communication
- Test authentication flows
- Test key_manager (KMS) functionality
- Test storage_manager (S3) functionality
- Test each service as it's implemented

### Running Tests
```bash
# Run all tests
npm test

# Run tests for specific service
npm test -- key_manager

# Run with coverage
npm test -- --coverage
```

## Contributing

1. Review the `plan.md` for implementation tasks
2. Follow the coding standards (service/repo pattern, DRY principles)
3. Ensure Docker containers are properly configured
4. Add `.env` and `.env_example` files for every service
5. Add integration tests for new features
6. Follow the frontend structure (components, hooks, styles, utils)
7. Update documentation

## License

[Add your license here]

## Roadmap

See `plan.md` for detailed implementation plan and task list.

## Support

For issues and questions, please open an issue on the repository.

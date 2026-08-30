# Creating a New Service - Best Practices Guide

This guide provides best practices and patterns for creating new services in aerekos-cloud. Follow this guide to ensure consistency, scalability, and maintainability across all services.

## Table of Contents

1. [Service Architecture](#service-architecture)
2. [Project Structure](#project-structure)
3. [Service Registration](#service-registration)
4. [Inter-Service Communication](#inter-service-communication)
5. [Database Management](#database-management)
6. [Authentication & Security](#authentication--security)
7. [Health Checks & Monitoring](#health-checks--monitoring)
8. [Testing](#testing)
9. [Documentation](#documentation)
10. [Docker Setup](#docker-setup)

## Service Architecture

### Core Principles

1. **Service/Repository Pattern**: Follow strict separation of concerns
   - **Routes**: Thin HTTP handlers, only parse requests and call services
   - **Services**: Business logic, orchestration, validation
   - **Repositories**: Data access only, no business logic

2. **DRY (Don't Repeat Yourself)**: Extract common functionality
   - Create shared utilities for common patterns
   - Reuse authentication middleware
   - Share connection pooling logic

3. **Separation of Concerns**: Each layer has a single responsibility
   - Routes handle HTTP
   - Services handle business logic
   - Repositories handle data access

### Service Communication Flow

```
Service A → Conductor API → Service B
```

**All inter-service communication goes through conductor API**:
- Services never call each other directly
- Conductor acts as router/proxy
- Enables load balancing across multiple service instances
- Centralized authentication and authorization

## Project Structure

### Standard Folder Structure

```
service_name/
├── api/
│   ├── routes/          # Express routes (thin controllers)
│   │   └── index.js     # Route definitions
│   ├── services/         # Business logic layer
│   │   └── ServiceNameService.js
│   ├── repos/           # Data access layer
│   │   └── ServiceNameRepository.js
│   ├── middleware/      # Express middleware
│   │   ├── auth.js      # Service-to-service auth
│   │   └── errorHandler.js
│   ├── utils/           # Utility functions
│   │   └── helpers.js
│   └── models/          # Database models (using aerekos-record)
│       └── index.js
├── scripts/
│   └── docker-entrypoint.sh
├── storage/             # Service-specific storage (gitignored)
├── data/                # SQLite/metadata storage (gitignored)
├── tests/
│   ├── unit/            # Unit tests
│   ├── integration/     # Integration tests
│   └── helpers/         # Test utilities
├── .env_example         # Environment variable template
├── .env                 # Actual env vars (gitignored)
├── .gitignore
├── Dockerfile           # Production Dockerfile
├── Dockerfile.dev       # Development Dockerfile
├── docker-compose.yml   # Service docker-compose
├── package.json
├── plan.md              # Service implementation plan
├── README.md            # Service documentation
└── api/
    └── openapi.yaml     # OpenAPI specification
```

## Service Registration

### Auto-Registration on Startup

Every service must auto-register with conductor on startup:

```javascript
// api/utils/serviceRegistration.js
const axios = require('axios');

async function registerWithConductor() {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceName = process.env.SERVICE_NAME || 'your_service';
  const serviceVersion = process.env.SERVICE_VERSION || '1.0.0';
  const port = await detectAvailablePort(process.env.PORT || 3000);
  
  try {
    const response = await axios.post(`${conductorUrl}/api/services/register`, {
      name: serviceName,
      version: serviceVersion,
      port: port,
      health_endpoint: '/health',
      ready_endpoint: '/ready',
      capabilities: ['capability1', 'capability2'], // Service-specific capabilities
      metadata: {
        // Additional service metadata
      }
    });
    
    console.log(`[${serviceName}] Registered with conductor: ${response.data.service_id}`);
    return response.data;
  } catch (error) {
    console.error(`[${serviceName}] Registration failed:`, error.message);
    throw error;
  }
}

// Call on startup
registerWithConductor().catch(console.error);
```

### Port Auto-Detection

Services should auto-detect available ports:

```javascript
// api/utils/portDetection.js
const net = require('net');

async function detectAvailablePort(startPort) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    
    server.listen(startPort, () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
    
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        // Port in use, try next port
        detectAvailablePort(startPort + 1).then(resolve).catch(reject);
      } else {
        reject(err);
      }
    });
  });
}
```

## Inter-Service Communication

### Calling Other Services via Conductor

**Never call services directly**. Always go through conductor:

```javascript
// api/utils/serviceClient.js
const axios = require('axios');

class ServiceClient {
  constructor(conductorUrl, serviceToken) {
    this.conductorUrl = conductorUrl;
    this.serviceToken = serviceToken;
  }
  
  async callService(serviceName, method, path, data = null) {
    const url = `${this.conductorUrl}/api/services/${serviceName}${path}`;
    
    try {
      const response = await axios({
        method,
        url,
        data,
        headers: {
          'Authorization': `Bearer ${this.serviceToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Service call failed: ${error.response.data.error?.message || error.message}`);
      }
      throw error;
    }
  }
}

// Usage example: Call key_manager
const serviceClient = new ServiceClient(process.env.CONDUCTOR_URL, process.env.SERVICE_TOKEN);
const key = await serviceClient.callService('key_manager', 'GET', '/api/keys/storage-encryption-key');
```

### Service Discovery

Services discover other services through conductor:

```javascript
// Get available service instances
const response = await axios.get(`${conductorUrl}/api/services`, {
  headers: { 'Authorization': `Bearer ${serviceToken}` }
});

const keyManagerInstances = response.data.services.filter(s => s.name === 'key_manager');
// Conductor handles load balancing, just use the service name in API calls
```

## Database Management

### Using db_manager for Database Creation

**Never create databases directly**. Always use db_manager:

```javascript
// api/utils/dbClient.js
const axios = require('axios');

async function createDatabaseViaDbManager(serviceName, dbType = 'postgresql') {
  const conductorUrl = process.env.CONDUCTOR_URL;
  const serviceToken = process.env.SERVICE_TOKEN;
  
  try {
    const response = await axios.post(
      `${conductorUrl}/api/services/db_manager/databases`,
      {
        name: `${serviceName}_db`,
        type: dbType,
        metadata: {
          service: serviceName
        }
      },
      {
        headers: {
          'Authorization': `Bearer ${serviceToken}`
        }
      }
    );
    
    const { connection_string, username, password, host, port, database } = response.data;
    
    // Store connection details securely
    // Use aerekos-record to connect
    const Record = require('aerekos-record');
    const db = Record.connect(dbType, {
      host,
      port,
      database,
      user: username,
      password
    });
    
    return db;
  } catch (error) {
    console.error('Database creation failed:', error.message);
    throw error;
  }
}
```

### Database Models with aerekos-record

**CRITICAL**: All models MUST use aerekos-record. Never use raw SQL, Sequelize, Mongoose, or other ORMs.

```javascript
// api/models/index.js
const db = require('../utils/dbClient'); // Connected aerekos-record instance

// Example: SQLite model (for small/local databases)
const YourModel = db.model('YourModel', {
  field1: 'string',
  field2: 'number',
  field3: 'number'  // Note: SQLite uses 'number' (0/1) instead of boolean
}, {
  required: ['field1'],
  unique: ['field2'],
  timestamps: true,  // Automatically adds created_at and updated_at
  // Optional: belongsTo: ['OtherModel'], hasMany: ['RelatedModel']
});

// Example: PostgreSQL model (via db_manager)
// Same syntax, just connect to PostgreSQL instead of SQLite
const db = Record.connect('postgresql', {
  host: 'localhost',
  port: 5432,
  database: 'your_db',
  user: 'user',
  password: 'password'
});

const YourModel = db.model('YourModel', {
  field1: 'string',
  field2: 'number',
  field3: 'boolean'  // PostgreSQL supports boolean
}, {
  required: ['field1'],
  unique: ['field2'],
  timestamps: true
});

module.exports = { YourModel, db };
```

**Model Usage**:
```javascript
const { YourModel } = require('../models');

// Create
const instance = await YourModel.create({
  field1: 'value',
  field2: 123,
  field3: 1
});

// Find
const found = await YourModel.findAll({ where: { field1: 'value' } });
const one = await YourModel.find(instance.id);

// Update
await YourModel.update(instance.id, { field2: 456 });

// Delete
await YourModel.delete(instance.id);
```

## Authentication & Security

### Service-to-Service Authentication

All service-to-service calls require tokens issued by conductor:

```javascript
// api/middleware/auth.js
const axios = require('axios');

async function validateServiceToken(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({
      error: { message: 'Service token required', status: 401 }
    });
  }
  
  try {
    // Validate token with conductor
    const response = await axios.post(
      `${process.env.CONDUCTOR_URL}/api/services/validate-token`,
      { token },
      { headers: { 'Authorization': `Bearer ${process.env.SERVICE_TOKEN}` } }
    );
    
    req.service = response.data.service; // Attach service info
    next();
  } catch (error) {
    return res.status(401).json({
      error: { message: 'Invalid service token', status: 401 }
    });
  }
}

// Apply to routes
router.use('/api', validateServiceToken);
```

### Input Validation

Always validate inputs:

```javascript
// api/middleware/validation.js
const Joi = require('joi');

function validate(schema) {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: { message: error.details[0].message, status: 400 }
      });
    }
    next();
  };
}

// Usage
const createSchema = Joi.object({
  name: Joi.string().required().min(3).max(100),
  type: Joi.string().valid('type1', 'type2').required()
});

router.post('/api/resource', validate(createSchema), async (req, res) => {
  // Handler
});
```

## Health Checks & Monitoring

### Required Health Endpoints

Every service must implement:

```javascript
// GET /health - Liveness probe
router.get('/health', async (req, res) => {
  try {
    // Check service is running
    // Check critical dependencies (database, etc.)
    const isHealthy = await checkHealth();
    
    if (isHealthy) {
      res.status(200).json({
        status: 'healthy',
        service: process.env.SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'unhealthy',
        service: process.env.SERVICE_NAME,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message
    });
  }
});

// GET /ready - Readiness probe
router.get('/ready', async (req, res) => {
  try {
    // Check service is ready to accept requests
    // Check all dependencies are available
    const isReady = await checkReadiness();
    
    if (isReady) {
      res.status(200).json({ status: 'ready' });
    } else {
      res.status(503).json({ status: 'not ready' });
    }
  } catch (error) {
    res.status(503).json({ status: 'not ready', error: error.message });
  }
});

// GET /metrics - Prometheus-style metrics
router.get('/metrics', async (req, res) => {
  const metrics = {
    requests_total: requestCounter,
    requests_failed: errorCounter,
    response_time_ms: averageResponseTime,
    // Service-specific metrics
  };
  
  res.json(metrics);
});
```

## Testing

### Test Structure

```
tests/
├── unit/
│   ├── services/        # Service unit tests
│   ├── repos/           # Repository unit tests
│   └── utils/           # Utility tests
├── integration/
│   ├── api.test.js      # API endpoint tests
│   └── service.test.js  # Service integration tests
└── helpers/
    ├── mockConductor.js # Mock conductor responses
    └── testHelpers.js   # Test utilities
```

### Testing Best Practices

1. **Unit Tests**: Test individual functions/services in isolation
2. **Integration Tests**: Test API endpoints with mocked dependencies
3. **Mock External Services**: Mock conductor, db_manager, key_manager calls
4. **Test Error Cases**: Not just happy paths
5. **Test Authentication**: Verify service token validation

```javascript
// tests/unit/services/YourService.test.js
const YourService = require('../../../api/services/YourService');
const YourRepository = require('../../../api/repos/YourRepository');

jest.mock('../../../api/repos/YourRepository');

describe('YourService', () => {
  let service;
  let mockRepository;
  
  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn()
    };
    YourRepository.mockImplementation(() => mockRepository);
    service = new YourService(mockRepository);
  });
  
  test('should create resource', async () => {
    mockRepository.create.mockResolvedValue({ id: '123', name: 'test' });
    
    const result = await service.createResource({ name: 'test' });
    
    expect(result).toHaveProperty('id');
    expect(mockRepository.create).toHaveBeenCalled();
  });
});
```

## Documentation

### OpenAPI Specification

Every service must include an OpenAPI specification:

```yaml
# api/openapi.yaml
openapi: 3.0.0
info:
  title: Your Service API
  version: 1.0.0
  description: Service description

servers:
  - url: http://localhost:3000
    description: Local development
  - url: https://conductor.example.com/api/services/your_service
    description: Production (via conductor)

paths:
  /api/resource:
    post:
      summary: Create resource
      tags: [Resources]
      security:
        - ServiceToken: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required: [name]
              properties:
                name:
                  type: string
      responses:
        '201':
          description: Resource created
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Resource'

components:
  securitySchemes:
    ServiceToken:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

### README Template

```markdown
# Service Name

## Overview
Brief description of what the service does.

## Features
- Feature 1
- Feature 2

## Dependencies
- **Conductor**: Service registration, routing
- **db_manager**: Database creation
- **key_manager**: Encryption keys (if needed)
- **storage_manager**: Object storage (if needed)

## Setup

### Prerequisites
- Node.js 18+
- Docker and Docker Compose

### Installation
1. Copy `.env_example` to `.env`
2. Update environment variables
3. `npm install`
4. `npm start`

### Docker
```bash
docker-compose up --build
```

## API Documentation
See `api/openapi.yaml` for full API documentation.

## Testing
```bash
npm test
```

## Configuration
See `.env_example` for all configuration options.
```

## Docker Setup

### Dockerfile (Production)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE ${PORT:-3000}

CMD ["node", "index.js"]
```

### Dockerfile.dev (Development)

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE ${PORT:-3000}

CMD ["npm", "run", "dev"]
```

### docker-compose.yml

```yaml
services:
  your_service:
    build:
      context: .
      dockerfile: Dockerfile.dev
    container_name: your-service
    ports:
      - "${PORT:-3000}:${PORT:-3000}"
    volumes:
      - ./data:/app/data
      - ./storage:/app/storage
      - ./api:/app/api
      - ./index.js:/app/index.js
    env_file:
      - .env
    environment:
      - NODE_ENV=development
      - PORT=${PORT:-3000}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--quiet", "--tries=1", "--spider", "-O", "-", "http://localhost:${PORT:-3000}/health"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - aerekos-cloud-network

networks:
  aerekos-cloud-network:
    external: true
```

### docker-entrypoint.sh

```bash
#!/bin/sh
set -e

echo "[YourService] Starting service..."

# Auto-detect port if needed
if [ -z "$PORT" ]; then
  PORT=$(node -e "const net = require('net'); const server = net.createServer(); server.listen(0, () => { console.log(server.address().port); server.close(); });")
  export PORT
fi

# Wait for dependencies (if needed)
# wait-for-it.sh conductor:3000 --timeout=30

# Start service
exec node index.js
```

## Environment Variables

### Required Variables

```bash
# Service Identity
SERVICE_NAME=your_service
SERVICE_VERSION=1.0.0
PORT=3000

# Conductor
CONDUCTOR_URL=http://conductor:3000
SERVICE_TOKEN=your_service_token_from_conductor

# Database (via db_manager)
DB_MANAGER_URL=http://conductor:3000/api/services/db_manager
DATABASE_NAME=your_service_db

# Optional Dependencies
KEY_MANAGER_URL=http://conductor:3000/api/services/key_manager
STORAGE_MANAGER_URL=http://conductor:3000/api/services/storage_manager

# Logging
LOG_LEVEL=info
NODE_ENV=development
```

## Common Patterns

### Error Handling

```javascript
// api/middleware/errorHandler.js
function errorHandler(err, req, res, next) {
  console.error('[Error]', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  
  res.status(status).json({
    error: {
      message,
      status,
      timestamp: new Date().toISOString(),
      path: req.path
    }
  });
}

// Apply to app
app.use(errorHandler);
```

### Logging

```javascript
// api/utils/logger.js
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  defaultMeta: { service: process.env.SERVICE_NAME },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

module.exports = logger;
```

### Request ID Tracking

```javascript
// api/middleware/requestId.js
const { v4: uuidv4 } = require('uuid');

function requestIdMiddleware(req, res, next) {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
}
```

## Checklist

Before considering a service complete:

- [ ] Service auto-registers with conductor on startup
- [ ] Port auto-detection implemented
- [ ] All inter-service calls go through conductor
- [ ] Database created via db_manager
- [ ] Service-to-service authentication implemented
- [ ] Health checks (`/health`, `/ready`) implemented
- [ ] Metrics endpoint (`/metrics`) implemented
- [ ] Input validation on all endpoints
- [ ] Error handling middleware
- [ ] Structured logging
- [ ] Unit tests written
- [ ] Integration tests written
- [ ] OpenAPI specification complete
- [ ] README documentation complete
- [ ] Docker setup complete
- [ ] Environment variables documented
- [ ] `.env_example` file created

## Examples

See these services for reference implementations:
- `worker/key_manager/` - Key management with USB master key
- `worker/storage_manager/` - S3-compatible object storage
- `worker/db_manager/` - Database instance management

## Questions?

If you have questions about service implementation:
1. Check existing service implementations
2. Review `backend_guidelines.md` for architecture patterns
3. Review `testing_guidelines.md` for testing practices
4. Check service-specific `plan.md` files for detailed implementation steps


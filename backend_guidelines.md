# Backend Coding Guidelines

## Architecture Pattern

### Service/Repository Pattern

Follow a strict service/repository pattern for all backend code:

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

### Principles

- **Services Layer**: Business logic should live in service classes (e.g., `UserService`, `KeyService`)
  - Services contain all business rules and validation
  - Services orchestrate multiple repositories if needed
  - Services handle transactions and complex operations
  
- **Repository Layer**: Database operations should live in repository classes (e.g., `UserRepository`, `KeyRepository`)
  - Repositories only handle CRUD operations
  - Repositories abstract database implementation details
  - Repositories return domain models, not raw database rows
  
- **Routes**: Keep routes thin - they should only:
  - Parse request parameters
  - Call service methods
  - Return responses
  - Handle HTTP-specific concerns

- **DRY Principle**: Don't Repeat Yourself
  - Extract common functionality into utilities/services
  - Create base classes for common patterns
  - Reuse code across services

- **Separation of Concerns**: Each layer has a single responsibility
  - Routes handle HTTP
  - Services handle business logic
  - Repositories handle data access

## Code Structure

### Service Example

```javascript
// services/UserService.js
class UserService {
  constructor(userRepository, jwtService) {
    this.userRepository = userRepository;
    this.jwtService = jwtService;
  }
  
  async authenticate(username, password) {
    // Business logic here
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Invalid credentials');
    }
    // Validate password, generate token, etc.
    return this.jwtService.generateToken(user);
  }
}
```

### Repository Example

```javascript
// repos/UserRepository.js
class UserRepository {
  constructor(db) {
    this.db = db;
  }
  
  async findByUsername(username) {
    // Database operations only
    return await this.db.model('User').findOne({ where: { username } });
  }
  
  async create(userData) {
    return await this.db.model('User').create(userData);
  }
}
```

### Route Example

```javascript
// routes/auth.js
const express = require('express');
const router = express.Router();
const UserService = require('../services/UserService');

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const token = await userService.authenticate(username, password);
    res.json({ token });
  } catch (error) {
    next(error);
  }
});
```

## Environment Files

- Every service (including conductor) must have:
  - `.env` - Actual environment variables (gitignored)
  - `.env_example` - Template with all required variables (committed)

Example `.env_example`:
```bash
PORT=3000
DATABASE_PATH=./data/conductor.db
JWT_SECRET=your-secret-key-here
CONDUCTOR_URL=http://conductor:3000
```

## Error Handling

- Use try/catch blocks in routes
- Create custom error classes for different error types
- Use error middleware for consistent error responses
- Log errors appropriately
- Never expose internal errors to clients

## Database

- **Always use the local `aerekos-record` folder** - do not install from npm
- **Conductor**: Use `conductor/api/services/aerekos-record` for database operations
- **Worker/Services**: Use `worker/services/aerekos-record` for database operations
- **Choose the database that fits your needs** - aerekos-record supports multiple database types:
  - **SQLite**: Local database on the device (good for conductor and simple services)
  - **PostgreSQL**: Use via `db_manager` service to store on another device
  - **MongoDB**: Use via `db_manager` service to store on another device
  - **Neo4j**: Use via `db_manager` service to store on another device
  - **Elasticsearch**: Use via `db_manager` service to store on another device
  - **Redis**: Use via `db_manager` service to store on another device
- **SQLite vs Other Databases**:
  - SQLite: Local file-based database, stored directly on the device
  - Other databases: Use `db_manager` service to create/manage databases on other devices
- Keep database logic in repositories only
- Use transactions for multi-step operations (where supported)
- Handle database errors gracefully

### Using aerekos-record

```javascript
// Conductor example - SQLite (local)
const Record = require('./api/services/aerekos-record');

// Connect to SQLite (local database)
const db = Record.connect('sqlite', {
  database: process.env.DATABASE_PATH || './data/conductor.db'
});

// Define a model
const User = db.model('User', {
  username: 'string',
  password_hash: 'string',
  email: 'string'
}, {
  required: ['username', 'email'],
  unique: ['username', 'email'],
  timestamps: true
});
```

```javascript
// Worker/Service example - SQLite (local)
// From worker root: use worker/services/aerekos-record
// From service folder: use ../../services/aerekos-record
const Record = require('../../services/aerekos-record');

// Connect to SQLite (local database)
const db = Record.connect('sqlite', {
  database: process.env.DATABASE_PATH || './data/service.db'
});
```

```javascript
// Service example - PostgreSQL (via db_manager)
const Record = require('../../services/aerekos-record');

// First, use db_manager service to create/get database
// Then connect using connection details from db_manager
const db = Record.connect('psql', {
  host: process.env.DB_HOST, // From db_manager
  port: process.env.DB_PORT,
  database: process.env.DB_NAME, // Created via db_manager
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});
```

```javascript
// Service example - Elasticsearch (via db_manager)
const Record = require('../../services/aerekos-record');

// Connect to Elasticsearch (created via db_manager)
const db = Record.connect('elasticsearch', {
  node: process.env.ES_NODE, // From db_manager
  index: process.env.ES_INDEX
});
```

```javascript
// Service example - Neo4j (via db_manager)
const Record = require('../../services/aerekos-record');

// Connect to Neo4j (created via db_manager)
const db = Record.connect('neo4j', {
  uri: process.env.NEO4J_URI, // From db_manager
  user: process.env.NEO4J_USER,
  password: process.env.NEO4J_PASSWORD
});
```

### Database Selection Guidelines

- **Use SQLite when**:
  - Data is small to medium size
  - Single-device storage is acceptable
  - Simple CRUD operations
  - Conductor (always uses SQLite for state)

- **Use PostgreSQL/MongoDB/Neo4j/Elasticsearch when**:
  - Need distributed storage across devices
  - Large datasets
  - Complex queries or relationships
  - Use `db_manager` service to create/manage the database
  - Request database creation via conductor API: `POST /api/db_manager/databases`

## Inter-Service Communication

- Services can call other services via conductor API
- Use service client utilities for common service calls
- Document inter-service dependencies
- Handle service unavailability gracefully
- **Implement circuit breakers** to prevent cascading failures
- **Use retry logic** with exponential backoff for transient failures
- **Add timeout handling** for all inter-service calls
- **Implement health checks** before calling other services

## Testing

- Write unit tests for services and repositories
- Mock dependencies in tests
- Test error cases, not just happy paths
- Keep tests fast and isolated

## Enterprise Requirements (Production-Ready)

### Health Checks
- Every service must implement `/health` endpoint (liveness probe)
- Every service must implement `/ready` endpoint (readiness probe)
- Health checks should verify dependencies (database, other services)
- Return appropriate HTTP status codes (200 = healthy, 503 = unhealthy)

### Metrics & Observability
- Report metrics to `metrics_manager` service
- Track: request count, latency, error rate, resource usage
- Use structured logging (JSON format) with correlation IDs
- Log levels: DEBUG, INFO, WARN, ERROR
- Include request context in logs (user ID, request ID, etc.)

### Security
- Implement rate limiting on all public endpoints
- Validate and sanitize all inputs
- Use parameterized queries (prevent SQL injection)
- Implement service-to-service authentication
- Never log sensitive data (passwords, tokens, PII)
- Use HTTPS for all external communication

### Resilience
- Implement circuit breakers for external dependencies
- Use retry logic with exponential backoff
- Set timeouts on all external calls
- Handle graceful degradation when dependencies fail
- Implement idempotency for critical operations

### Performance
- Use connection pooling for databases
- Implement caching where appropriate
- Optimize database queries (use indexes)
- Monitor and optimize slow queries
- Use async/await for I/O operations

## Code Quality

- Use meaningful variable and function names
- Add comments for complex business logic
- Keep functions small and focused
- Avoid deep nesting (max 2-3 levels)
- Use async/await consistently
- Handle promises properly

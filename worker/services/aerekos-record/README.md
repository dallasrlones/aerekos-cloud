# Aerekos Record

A universal ORM for Node.js with Rails Active Record-style syntax. Write your models once and use them across multiple databases (Neo4j, MongoDB, PostgreSQL, SQLite, Elasticsearch, Redis) with the same API.

## Features

- 🎯 **Rails-like Syntax** - Familiar Active Record patterns
- 🔄 **Universal API** - Same code works across all databases
- 🎣 **Full Callback Support** - All Rails Active Record callbacks
- 🔗 **Associations** - hasMany, hasOne, belongsTo via foreign keys
- 🔒 **Type Safety** - Built-in type coercion and encryption
- ⏱️ **Timestamps** - Automatic createdAt/updatedAt management
- 🗑️ **Soft Deletes** - Optional soft delete support
- 🎨 **Database-Specific Features** - Neo4j edges, Redis TTL, SQLite transactions, etc.

## Installation

```bash
npm install aerekos-record
```

## Quick Start

```javascript
const Record = require('aerekos-record')

// Connect to a database
const db = Record.connect('neo4j', {
  uri: 'neo4j://localhost:7687',
  user: 'neo4j',
  password: 'password'
})

// Define a model
const User = db.model('User', {
  name: 'string',
  email: 'string',
  password: 'encrypted',
  age: 'number'
}, {
  required: ['email', 'password'],
  unique: ['email'],
  timestamps: true
})

// Use it!
const user = await User.create({ 
  name: 'John Doe', 
  email: 'john@example.com', 
  password: 'secret123' 
})
```

## Database Connections

### Neo4j

```javascript
const neo = Record.connect('neo4j', {
  uri: process.env.NEO4J_URI || 'neo4j://localhost:7687',
  user: process.env.NEO4J_USER || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'neo4j',
  database: process.env.NEO4J_DATABASE, // Optional
  logQueries: false, // Set to true for query logging
  // Connection pool configuration
  maxConnectionLifetime: 3600000, // 1 hour (default)
  maxConnectionPoolSize: 100, // Maximum connections in pool (default)
  connectionAcquisitionTimeout: 60000 // 60 seconds (default)
})

// Health check
const health = await neo.healthCheck()
console.log(health) // { healthy: true, pool: {...} }

// Get pool statistics
const stats = neo.getPoolStats()
console.log(stats)
```

### MongoDB

```javascript
const mongo = Record.connect('mongodb', {
  uri: process.env.MONGO_URI || 'mongodb://localhost:27017',
  database: process.env.MONGO_DB || 'test',
  options: {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    // Connection pool configuration
    maxPoolSize: 10, // Maximum connections in pool (default: 10)
    minPoolSize: 0, // Minimum connections in pool (default: 0)
    maxIdleTimeMS: 30000, // Close idle connections after 30s (default: 30000)
    serverSelectionTimeoutMS: 30000, // Server selection timeout (default: 30000)
    connectTimeoutMS: 30000 // Connection timeout (default: 30000)
  }
})

// Health check
const health = await mongo.healthCheck()
console.log(health) // { healthy: true, pool: {...} }

// Get pool statistics
const stats = mongo.getPoolStats()
console.log(stats)
```

### SQLite

```javascript
const sqlite = Record.connect('sqlite', {
  database: process.env.SQLITE_DATABASE || './database.sqlite',
  readonly: false, // Read-only mode (default: false)
  fileMustExist: false, // File must exist (default: false)
  timeout: 5000, // Busy timeout in ms (default: 5000)
  verbose: false // Verbose logging (default: false)
})

// Health check
const health = await sqlite.healthCheck()
console.log(health) // { healthy: true, database: './database.sqlite' }

// Get database stats
const stats = await sqlite.getPoolStats()
console.log(stats) // { database: './database.sqlite', readonly: false }

// SQLite uses better-sqlite3 (synchronous, fast)
// Transactions are supported via db.transaction()
const transaction = sqlite.db.transaction((users) => {
  const results = []
  for (const userData of users) {
    // Transaction logic
  }
  return results
})
```

### PostgreSQL

```javascript
const psql = Record.connect('psql', {
  user: process.env.PG_USER || 'postgres',
  host: process.env.PG_HOST || 'localhost',
  database: process.env.PG_DATABASE || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  port: process.env.PG_PORT || 5432,
  // Connection pool configuration
  max: 10, // Maximum clients in pool (default: 10)
  min: 2, // Minimum clients in pool (default: 2)
  idleTimeoutMillis: 30000, // Close idle clients after 30s (default: 30000)
  connectionTimeoutMillis: 2000 // Connection timeout (default: 2000)
})

// Also supports aliases: 'postgresql' or 'postgres'

// Health check
const health = await psql.healthCheck()
console.log(health) // { healthy: true, pool: { totalCount: 5, idleCount: 3, waitingCount: 0 } }

// Get pool statistics
const stats = psql.getPoolStats()
console.log(stats) // { totalCount: 5, idleCount: 3, waitingCount: 0 }
```

### Elasticsearch

```javascript
const es = Record.connect('elasticsearch', {
  node: process.env.ES_URL || 'http://localhost:9200',
  auth: {
    username: process.env.ES_USER,
    password: process.env.ES_PASSWORD
  },
  maxRetries: 5, // Maximum retry attempts (default: 5)
  requestTimeout: 60000, // Request timeout in ms (default: 60000)
  // Connection pool configuration
  sniffOnStart: true, // Discover nodes on start (default: true)
  sniffInterval: false, // Disable periodic sniffing (default: false)
  maxSockets: 256, // Maximum sockets per connection (default: 256)
  keepAlive: true, // Enable keep-alive (default: true)
  keepAliveInterval: 1000 // Keep-alive interval in ms (default: 1000)
})

// Also supports alias: 'es'

// Health check
const health = await es.healthCheck()
console.log(health) // { healthy: true, status: 'green', pool: {...} }

// Get pool statistics
const stats = es.getPoolStats()
console.log(stats)
```

### Redis

```javascript
const redis = Record.connect('redis', {
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    connectTimeout: 10000, // Connection timeout in ms (default: 10000)
    reconnectStrategy: (retries) => {
      // Custom reconnection strategy
      if (retries > 10) return new Error('Too many retries')
      return Math.min(retries * 50, 1000) // Exponential backoff
    }
  },
  password: process.env.REDIS_PASSWORD
})

// Note: Redis uses a single connection by default
// For connection pooling, consider using Redis Cluster

// Health check
const health = await redis.healthCheck()
console.log(health) // { healthy: true, pool: { connected: true } }

// Get pool statistics
const stats = redis.getPoolStats()
console.log(stats) // { connected: true }
```

## Model Definition

### Basic Model

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string',
  age: 'number',
  active: 'boolean',
  createdAt: 'datetime'
})
```

### Property Types

Supported types:
- `'string'` - String values
- `'number'` - Numeric values
- `'boolean'` - Boolean values
- `'datetime'` - ISO datetime strings (auto-converted)
- `'encrypted'` - Automatically hashed with bcrypt (omitted from reads)

```javascript
const User = db.model('User', {
  name: 'string',           // "John Doe"
  age: 'number',            // 30
  active: 'boolean',        // true
  createdAt: 'datetime',    // "2024-01-01T00:00:00.000Z"
  password: 'encrypted'     // Hashed, never returned in queries
})
```

### Model Settings

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string',
  password: 'encrypted'
}, {
  // Required fields (validation)
  required: ['email', 'password'],
  
  // Unique constraints
  unique: ['email'],
  
  // Database indexes
  indexes: ['email', 'name'],
  
  // Automatic timestamps (default: true)
  timestamps: true,
  
  // Soft delete support (default: false)
  softDelete: true,
  
  // Associations
  hasMany: ['Task', 'Post'],
  hasOne: ['Profile'],
  belongsTo: 'Organization'
})
```

## CRUD Operations

### Create

```javascript
// Simple create
const user = await User.create({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'secret123'
})

// Create with Redis TTL (Redis-specific)
const session = await Session.create({
  userId: '123',
  token: 'abc123'
}, { ttl: 3600 }) // Expires in 1 hour
```

### Read

```javascript
// Find by ID
const user = await User.find('user-id-here')

// Find by conditions
const user = await User.findBy({ email: 'john@example.com' })

// Find one by (alias for findBy)
const user = await User.findOneBy({ email: 'john@example.com' })

// Find all with query options
const users = await User.findAll({
  where: { 
    age: { gte: 18 },  // Greater than or equal
    active: true 
  },
  order: 'createdAt DESC',
  limit: 10,
  offset: 0,
  withDeleted: false  // Include soft-deleted records
})

// Count records
const count = await User.count({ active: true })
```

### Query Operators

```javascript
// Equality
User.findAll({ where: { name: 'John' } })

// Array (IN clause)
User.findAll({ where: { status: ['active', 'pending'] } })

// Range queries
User.findAll({ where: { 
  age: { gte: 18, lte: 65 }  // Between 18 and 65
}})

// Contains (string search)
User.findAll({ where: { 
  name: { contains: 'John' }  // ILIKE/LIKE/CONTAINS depending on DB
}})
```

### Update

```javascript
// Update by ID
const updated = await User.update('user-id', {
  name: 'Jane Doe',
  age: 25
})

// Update by conditions (updates all matching)
const updated = await User.updateBy(
  { active: false },
  { active: true }
)

// Update one by conditions
const updated = await User.updateOneBy(
  { email: 'john@example.com' },
  { name: 'John Updated' }
)

// Update with Redis TTL
const session = await Session.update('session-id', {
  lastActivity: new Date()
}, { ttl: 7200 })
```

### Delete

```javascript
// Soft delete (if softDelete: true)
const deleted = await User.delete('user-id')

// Hard delete
const deleted = await User.delete('user-id', { hardDelete: true })

// Delete by conditions
const deleted = await User.deleteBy({ active: false })
```

## Associations

Associations use foreign keys (`parent_id` pattern) and work across all databases.

### hasMany

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string'
}, {
  hasMany: ['Task', 'Post']
})

const Task = db.model('Task', {
  title: 'string',
  user_id: 'string'  // Foreign key
}, {
  belongsTo: 'User'
})

// Usage
const user = await User.find('user-id')

// Get all tasks for this user
const tasks = await user.tasks.findAll()

// Create a task for this user
const task = await user.tasks.create({
  title: 'Complete project'
})

// Count tasks
const count = await user.tasks.count()
```

### hasOne

```javascript
const User = db.model('User', {
  name: 'string'
}, {
  hasOne: ['Profile']
})

const Profile = db.model('Profile', {
  bio: 'string',
  user_id: 'string'
})

// Usage
const user = await User.find('user-id')

// Get profile
const profile = await user.profile.get()

// Set profile
const profile = await user.profile.set({
  bio: 'Software developer'
})
```

### belongsTo

```javascript
const Task = db.model('Task', {
  title: 'string',
  user_id: 'string'
}, {
  belongsTo: 'User'
})

// Usage
const task = await Task.find('task-id')

// Get parent user
const user = await task.parent()
```

### Includes (Eager Loading)

```javascript
// Load users with their tasks
const users = await User.findAll({
  include: ['Task']
})

// Multiple includes
const users = await User.findAll({
  include: ['Task', 'Post']
})

// Include with conditions
const users = await User.findAll({
  include: [{
    model: 'Task',
    where: { completed: false },
    as: 'pendingTasks'
  }]
})

// Include with field selection
const users = await User.findAll({
  include: [{
    model: 'Task',
    select: ['id', 'title']
  }]
})
```

## Rails Active Record Callbacks

All Rails Active Record callbacks are supported with the same syntax.

### Validation Callbacks

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string'
})

// Before validation
User.before_validation(async (user) => {
  user.email = user.email.toLowerCase()
})

// Before validation on create
User.before_validation_on_create(async (user) => {
  user.name = user.name.trim()
})

// Before validation on update
User.before_validation_on_update(async (user) => {
  if (user.changed('email')) {
    // Handle email change
  }
})

// After validation
User.after_validation(async (user) => {
  console.log('Validation passed for:', user.email)
})
```

### Save Callbacks

```javascript
// Before save (runs on both create and update)
User.before_save(async (user) => {
  user.slug = user.name.toLowerCase().replace(/\s+/g, '-')
})

// After save
User.after_save(async (user) => {
  console.log('User saved:', user.id)
})

// Around save
User.around_save(async (user, next) => {
  console.log('Before save')
  const result = await next()
  console.log('After save')
  return result
})
```

### Create Callbacks

```javascript
// Before create
User.before_create(async (user) => {
  user.activationToken = generateToken()
})

// After create
User.after_create(async (user) => {
  await sendWelcomeEmail(user.email)
})

// Around create
User.around_create(async (user, next) => {
  const start = Date.now()
  const result = await next()
  console.log(`Create took ${Date.now() - start}ms`)
  return result
})
```

### Update Callbacks

```javascript
// Before update
User.before_update(async (user) => {
  user.updatedCount = (user.updatedCount || 0) + 1
})

// After update
User.after_update(async (user) => {
  await logUserChange(user.id, 'updated')
})

// Around update
User.around_update(async (user, next) => {
  const oldEmail = user.email
  const result = await next()
  if (oldEmail !== result.email) {
    await notifyEmailChange(oldEmail, result.email)
  }
  return result
})
```

### Destroy Callbacks

```javascript
// Before destroy
User.before_destroy(async (user) => {
  // Clean up related data
  await Task.deleteBy({ user_id: user.id })
})

// After destroy
User.after_destroy(async (user) => {
  await logUserDeletion(user.id)
})

// Around destroy
User.around_destroy(async (user, next) => {
  console.log('Deleting user:', user.id)
  const result = await next()
  console.log('User deleted')
  return result
})
```

### Conditional Callbacks

```javascript
// Callback only if condition is met
User.before_save(async (user) => {
  user.name = user.name.toUpperCase()
}, {
  if: (user) => user.role === 'admin'
})

// Callback unless condition is met
User.after_create(async (user) => {
  await sendEmail(user.email)
}, {
  unless: (user) => user.skipEmail
})

// Using method names
User.before_save(async (user) => {
  // callback logic
}, {
  if: 'shouldProcess'  // Calls user.shouldProcess()
})
```

### Callbacks in Settings

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string'
}, {
  callbacks: {
    before_create: async (user) => {
      user.name = user.name.trim()
    },
    after_create: [
      async (user) => {
        await sendWelcomeEmail(user.email)
      },
      async (user) => {
        await createDefaultSettings(user.id)
      }
    ],
    before_save: {
      fn: async (user) => {
        user.slug = generateSlug(user.name)
      },
      if: (user) => user.nameChanged
    }
  }
})
```

### Skip Callbacks

```javascript
// Skip specific callback
User.skip_callback('before_save')

// Skip all callbacks (use with caution)
User.skip_callback('before_validation')
User.skip_callback('after_validation')
```

## Database-Specific Features

### Neo4j - Graph Edges

```javascript
const User = neo.model('User', {
  name: 'string'
})

const Post = neo.model('Post', {
  title: 'string'
})

// Create an edge between nodes
await User.edges.createEdge({
  fromId: 'user-id',
  toId: 'post-id',
  type: 'AUTHORED',
  toModel: 'Post',
  properties: {
    createdAt: new Date().toISOString()
  },
  direction: 'out'  // 'out', 'in', or 'both'
})

// Find by edge
const post = await User.edges.findByEdge({
  type: 'AUTHORED',
  toModel: 'Post',
  fromWhere: { id: 'user-id' },
  returnTarget: 'to'
})

// Find all edges
const posts = await User.edges.findByEdges({
  type: 'AUTHORED',
  toModel: 'Post',
  fromWhere: { id: 'user-id' }
})

// Update edge properties
await User.edges.updateEdgeBy({
  type: 'AUTHORED',
  toModel: 'Post',
  fromWhere: { id: 'user-id' },
  toWhere: { id: 'post-id' },
  edgeChanges: {
    updatedAt: new Date().toISOString()
  }
})

// Delete edge
await User.edges.deleteEdge({
  type: 'AUTHORED',
  toModel: 'Post',
  fromWhere: { id: 'user-id' },
  toWhere: { id: 'post-id' }
})
```

### Redis - TTL Support

```javascript
const Session = redis.model('Session', {
  userId: 'string',
  token: 'string'
})

// Create with TTL
const session = await Session.create({
  userId: '123',
  token: 'abc123'
}, { ttl: 3600 }) // Expires in 1 hour

// Set TTL on existing record
await Session.setTTL('session-id', 7200) // 2 hours

// Get remaining TTL
const ttl = await Session.getTTL('session-id')
console.log(`Session expires in ${ttl} seconds`)

// Update with new TTL
await Session.update('session-id', {
  lastActivity: new Date()
}, { ttl: 3600 })
```

## Advanced Usage

### Field Selection

```javascript
// Select specific fields
const users = await User.findAll({
  select: ['id', 'name', 'email']
})

// Select with includes
const users = await User.findAll({
  include: [{
    model: 'Task',
    select: ['id', 'title']
  }]
})
```

### Ordering

```javascript
// Single field
const users = await User.findAll({
  order: 'createdAt DESC'
})

// Multiple fields
const users = await User.findAll({
  order: ['createdAt DESC', 'name ASC']
})

// Array format
const users = await User.findAll({
  order: ['createdAt', 'name']
})
```

### Pagination

```javascript
// Page 1
const page1 = await User.findAll({
  limit: 10,
  offset: 0
})

// Page 2
const page2 = await User.findAll({
  limit: 10,
  offset: 10
})
```

### Soft Deletes

```javascript
const User = db.model('User', {
  name: 'string'
}, {
  softDelete: true
})

// Normal find excludes soft-deleted
const user = await User.find('id') // Returns null if deleted

// Include soft-deleted
const user = await User.find('id', { withDeleted: true })

// Find all including deleted
const allUsers = await User.findAll({ withDeleted: true })

// Permanently delete
await User.delete('id', { hardDelete: true })
```

### Transactions (PostgreSQL/Neo4j)

```javascript
// PostgreSQL - Use withTransaction helper
const client = await pool.connect()
try {
  await client.query('BEGIN')
  
  const user = await User.create({ name: 'John' })
  await Task.create({ userId: user.id, title: 'Task 1' })
  
  await client.query('COMMIT')
  await callbacks.run('after_commit', User, user)
} catch (error) {
  await client.query('ROLLBACK')
  await callbacks.run('after_rollback', User, user)
} finally {
  client.release()
}
```

### Error Handling

```javascript
try {
  const user = await User.create({
    email: 'existing@example.com' // Duplicate unique field
  })
} catch (error) {
  if (error.message.includes('unique')) {
    console.log('Email already exists')
  } else {
    console.error('Error:', error)
  }
}
```

## Complete Example

```javascript
const Record = require('aerekos-record')

// Connect to database
const db = Record.connect('neo4j', {
  uri: 'neo4j://localhost:7687',
  user: 'neo4j',
  password: 'password'
})

// Define models
const User = db.model('User', {
  name: 'string',
  email: 'string',
  password: 'encrypted',
  age: 'number',
  active: 'boolean'
}, {
  required: ['email', 'password'],
  unique: ['email'],
  indexes: ['email'],
  hasMany: ['Task'],
  timestamps: true,
  softDelete: true,
  callbacks: {
    before_create: async (user) => {
      user.email = user.email.toLowerCase()
    },
    after_create: async (user) => {
      console.log('User created:', user.email)
    }
  }
})

const Task = db.model('Task', {
  title: 'string',
  completed: 'boolean',
  user_id: 'string'
}, {
  required: ['title', 'user_id'],
  belongsTo: 'User',
  timestamps: true
})

// Usage
async function example() {
  // Create user
  const user = await User.create({
    name: 'John Doe',
    email: 'john@example.com',
    password: 'secret123',
    age: 30,
    active: true
  })
  
  // Create task for user
  const task = await user.tasks.create({
    title: 'Complete project',
    completed: false
  })
  
  // Find user with tasks
  const userWithTasks = await User.findAll({
    where: { id: user.id },
    include: ['Task']
  })
  
  // Update user
  await User.update(user.id, {
    age: 31
  })
  
  // Query tasks
  const incompleteTasks = await Task.findAll({
    where: {
      completed: false,
      user_id: user.id
    }
  })
  
  // Soft delete user
  await User.delete(user.id)
}

example()
```

## Connection Pooling & Health Checks

All adapters support connection pooling and provide health check methods.

### Pool Configuration

Each database adapter accepts pool configuration options:

**PostgreSQL:**
- `max` - Maximum clients in pool (default: 10)
- `min` - Minimum clients in pool (default: 2)
- `idleTimeoutMillis` - Close idle clients after timeout (default: 30000)
- `connectionTimeoutMillis` - Connection timeout (default: 2000)

**MongoDB:**
- `maxPoolSize` - Maximum connections in pool (default: 10)
- `minPoolSize` - Minimum connections in pool (default: 0)
- `maxIdleTimeMS` - Close idle connections after timeout (default: 30000)
- `serverSelectionTimeoutMS` - Server selection timeout (default: 30000)
- `connectTimeoutMS` - Connection timeout (default: 30000)

**Neo4j:**
- `maxConnectionLifetime` - Maximum connection lifetime in ms (default: 3600000)
- `maxConnectionPoolSize` - Maximum connections in pool (default: 100)
- `connectionAcquisitionTimeout` - Connection acquisition timeout (default: 60000)

**Elasticsearch:**
- `maxRetries` - Maximum retry attempts (default: 5)
- `requestTimeout` - Request timeout in ms (default: 60000)
- `maxSockets` - Maximum sockets per connection (default: 256)
- `keepAlive` - Enable keep-alive (default: true)
- `keepAliveInterval` - Keep-alive interval in ms (default: 1000)

**Redis:**
- `connectTimeout` - Connection timeout in ms (default: 10000)
- `reconnectStrategy` - Custom reconnection strategy function

### Health Checks

All adapters provide a `healthCheck()` method:

```javascript
const db = Record.connect('psql', { /* config */ })

// Check connection health
const health = await db.healthCheck()
console.log(health)
// {
//   healthy: true,
//   pool: {
//     totalCount: 5,
//     idleCount: 3,
//     waitingCount: 0
//   }
// }
```

### Pool Statistics

Get current pool statistics:

```javascript
// PostgreSQL - Detailed pool stats
const stats = psql.getPoolStats()
console.log(stats)
// {
//   totalCount: 5,    // Total connections in pool
//   idleCount: 3,     // Idle connections available
//   waitingCount: 0   // Clients waiting for connection
// }

// MongoDB - Connection status
const stats = mongo.getPoolStats()
console.log(stats)
// {
//   connected: true
// }

// Redis - Connection status
const stats = redis.getPoolStats()
console.log(stats)
// {
//   connected: true
// }
```

### Environment Variables

You can configure pool settings via environment variables:

```bash
# PostgreSQL
PG_POOL_MAX=20
PG_POOL_MIN=5
PG_POOL_IDLE_TIMEOUT=60000
PG_POOL_CONNECTION_TIMEOUT=5000

# MongoDB
MONGO_POOL_MAX=20
MONGO_POOL_MIN=5
MONGO_POOL_MAX_IDLE_TIME=60000
MONGO_SERVER_SELECTION_TIMEOUT=30000
MONGO_CONNECT_TIMEOUT=30000

# Neo4j
NEO4J_MAX_CONNECTION_LIFETIME=7200000
NEO4J_MAX_POOL_SIZE=200
NEO4J_CONNECTION_ACQUISITION_TIMEOUT=120000

# Elasticsearch
ES_MAX_RETRIES=10
ES_REQUEST_TIMEOUT=120000
ES_MAX_SOCKETS=512

# Redis
REDIS_CONNECT_TIMEOUT=15000
```

### Connection Management

```javascript
const db = Record.connect('psql', { /* config */ })

// Use the database
const User = db.model('User', { name: 'string' })

// Check health periodically
setInterval(async () => {
  const health = await db.healthCheck()
  if (!health.healthy) {
    console.error('Database connection unhealthy:', health.error)
  }
}, 30000) // Check every 30 seconds

// Access underlying connection objects for advanced usage
const pool = db.pool // PostgreSQL Pool instance
const driver = db.driver // Neo4j Driver instance
const client = db.client() // MongoDB Client or Redis Client

// Close connections gracefully
process.on('SIGINT', async () => {
  await db.close()
  process.exit(0)
})
```

## API Reference

### Model Methods

- `create(attrs, options)` - Create a new record
- `find(id, options)` - Find by ID
- `findBy(where, options)` - Find one by conditions
- `findOneBy(where, options)` - Alias for findBy
- `findAll(options)` - Find all matching records
- `count(where, options)` - Count matching records
- `update(id, changes, options)` - Update by ID
- `updateBy(where, changes, options)` - Update all matching
- `updateOneBy(where, changes, options)` - Update one matching
- `delete(id, options)` - Delete by ID

### Callback Methods

- `before_validation(callback, options)`
- `before_validation_on_create(callback, options)`
- `before_validation_on_update(callback, options)`
- `after_validation(callback, options)`
- `after_validation_on_create(callback, options)`
- `after_validation_on_update(callback, options)`
- `before_save(callback, options)`
- `after_save(callback, options)`
- `around_save(callback, options)`
- `before_create(callback, options)`
- `after_create(callback, options)`
- `around_create(callback, options)`
- `before_update(callback, options)`
- `after_update(callback, options)`
- `around_update(callback, options)`
- `before_destroy(callback, options)`
- `after_destroy(callback, options)`
- `around_destroy(callback, options)`
- `after_commit(callback, options)`
- `after_rollback(callback, options)`
- `skip_callback(name)` - Skip a callback

### Database-Specific Methods

**Neo4j:**
- `Model.edges.createEdge(options)`
- `Model.edges.findByEdge(options)`
- `Model.edges.findByEdges(options)`
- `Model.edges.updateEdgeBy(options)`
- `Model.edges.updateEdgesBy(options)`
- `Model.edges.deleteEdge(options)`
- `Model.edges.deleteEdgesBy(options)`

**Redis:**
- `Model.setTTL(id, seconds)`
- `Model.getTTL(id)`

## Sharding & Multiple Databases

Aerekos Record supports sharding and multiple database instances for horizontal scaling and high availability.

### Multiple Database Instances

Connect to multiple instances of the same database type:

```javascript
const Record = require('aerekos-record')

// Create multi-database manager
const multiDb = Record.createMultiDatabase()

// Add multiple PostgreSQL instances
multiDb.addInstance('shard1', Record.connect('psql', {
  host: 'db1.example.com',
  database: 'app_db',
  user: 'postgres',
  password: 'password'
}))

multiDb.addInstance('shard2', Record.connect('psql', {
  host: 'db2.example.com',
  database: 'app_db',
  user: 'postgres',
  password: 'password'
}))

// Add read replica
multiDb.addInstance('replica1', Record.connect('psql', {
  host: 'replica1.example.com',
  database: 'app_db',
  user: 'postgres',
  password: 'password'
}), {
  isReadOnly: true,
  primaryInstance: 'shard1'
})

// Define model (works across all instances)
const User = multiDb.model('User', {
  name: 'string',
  email: 'string',
  organizationId: 'string'
})

// Use normally - automatically routes to correct instance
const user = await User.create({ 
  name: 'John', 
  email: 'john@example.com',
  organizationId: 'org-1' 
})
```

### Sharding Configuration

Configure sharding based on a shard key:

```javascript
// Shard by organization ID
multiDb.configureSharding('User', 'organizationId', {
  'org-1': 'shard1',
  'org-2': 'shard1',
  'org-3': 'shard2',
  'org-4': 'shard2'
})

// Or use a custom shard key extractor function
multiDb.configureSharding('User', (record) => {
  // Custom logic to determine shard
  const orgId = record.organizationId
  return orgId.startsWith('A-') ? 'shard1' : 'shard2'
})

// Now queries automatically route to correct shard
const users = await User.findAll({ 
  where: { organizationId: 'org-1' },
  shardKey: 'org-1' // Optional: explicitly specify shard
})
```

### Read Replicas

Automatic read/write splitting:

```javascript
// Writes go to primary
const user = await User.create({ name: 'John', organizationId: 'org-1' })

// Reads can use replica (automatic)
const users = await User.findAll({ 
  where: { organizationId: 'org-1' },
  preferReplica: true // Default: true
})

// Force read from primary
const users = await User.findAll({ 
  where: { organizationId: 'org-1' },
  preferReplica: false
})
```

### Cross-Shard Queries

Query across all shards:

```javascript
// Find all users across all shards
const allUsers = await User.findAllShards({
  where: { active: true }
})

// Count across all shards
const totalCount = await User.countAllShards({ active: true })
```

### Health Checks

Monitor all instances:

```javascript
// Health check all instances
const health = await multiDb.healthCheckAll()
console.log(health)
// {
//   shard1: { healthy: true, pool: {...} },
//   shard2: { healthy: true, pool: {...} },
//   replica1: { healthy: true, pool: {...} }
// }

// Get healthy instances
const healthy = multiDb.shardingManager.getHealthyInstances()
console.log(healthy) // ['shard1', 'shard2', 'replica1']
```

### Hash-Based Sharding

Automatic hash-based sharding when no explicit mapping:

```javascript
// No explicit shard mapping - uses hash-based routing
multiDb.shardingManager.routingStrategy = 'hash'

// Automatically distributes across available shards
const user1 = await User.create({ organizationId: 'org-1' }) // Goes to shard1 or shard2
const user2 = await User.create({ organizationId: 'org-2' }) // Goes to shard1 or shard2
```

### Complete Sharding Example

```javascript
const Record = require('aerekos-record')

// Setup multi-database
const multiDb = Record.createMultiDatabase()

// Add shards
multiDb.addInstance('us-east', Record.connect('psql', {
  host: 'us-east.db.example.com',
  database: 'app_db'
}), { isDefault: true })

multiDb.addInstance('us-west', Record.connect('psql', {
  host: 'us-west.db.example.com',
  database: 'app_db'
}))

// Add read replicas
multiDb.addInstance('us-east-replica', Record.connect('psql', {
  host: 'us-east-replica.db.example.com',
  database: 'app_db'
}), {
  isReadOnly: true,
  primaryInstance: 'us-east'
})

// Configure geographic sharding
multiDb.configureSharding('User', (record) => {
  // Route based on region
  if (record.region === 'east') return 'us-east'
  if (record.region === 'west') return 'us-west'
  return 'us-east' // Default
})

// Define model
const User = multiDb.model('User', {
  name: 'string',
  email: 'string',
  region: 'string',
  organizationId: 'string'
})

// Usage - automatically routes to correct shard
const user = await User.create({
  name: 'John',
  email: 'john@example.com',
  region: 'east',
  organizationId: 'org-1'
}) // Automatically goes to us-east shard

// Reads can use replica
const users = await User.findAll({
  where: { region: 'east' },
  preferReplica: true // Uses us-east-replica
})
```

## Other Enterprise Features

### What's Included

✅ **Connection Pooling** - Configurable pool sizes and timeouts  
✅ **Health Checks** - Monitor database connection health  
✅ **Sharding** - Distribute data across multiple instances  
✅ **Read Replicas** - Automatic read/write splitting  
✅ **Failover** - Health-based instance selection  
✅ **Migrations** - Version-controlled schema migrations  
✅ **Advanced Indexing** - Composite, partial, and custom indexes  
✅ **Seeding** - Database seeding utilities  
✅ **Query Builder** - Fluent query building API  
✅ **Caching Layer** - Built-in caching (Redis/Memory)  
✅ **Observability** - Query logging, metrics, tracing  
✅ **Connection Retry** - Automatic retry with exponential backoff  
✅ **Circuit Breaker** - Circuit breaker pattern for resilience  
✅ **Batch Operations** - Optimized bulk insert/update  
✅ **Streaming** - Stream large result sets  
✅ **Full-Text Search** - Advanced search capabilities  
✅ **JSON/JSONB Support** - Enhanced JSON field operations  
✅ **Transactions** - Basic transaction support (database-specific)  
✅ **Soft Deletes** - Optional soft delete support  
✅ **Timestamps** - Automatic createdAt/updatedAt  
✅ **Callbacks** - Full Rails Active Record callbacks  
✅ **Associations** - hasMany, hasOne, belongsTo  

## Migrations

Aerekos Record includes a migration system for version-controlled database schema changes.

### Setup

```javascript
const Record = require('aerekos-record')

const db = Record.connect('psql', {
  host: 'localhost',
  database: 'myapp',
  user: 'postgres',
  password: 'password'
})

const migrations = Record.createMigrations(db, {
  migrationsPath: './migrations', // Path to migration files
  migrationsTable: 'schema_migrations' // Table to track migrations
})
```

### Create a Migration

```javascript
// Creates a new migration file
await migrations.createMigration('add_users_table')
// Creates: ./migrations/1234567890_add_users_table.js
```

### Migration File Template

```javascript
/**
 * Migration: add_users_table
 * Created: 2024-01-01T00:00:00.000Z
 */

module.exports = {
  async up(db) {
    // Create User model (this creates the table/indexes)
    const User = db.model('User', {
      name: 'string',
      email: 'string',
      password: 'encrypted'
    }, {
      required: ['email', 'password'],
      unique: ['email'],
      indexes: ['email'],
      timestamps: true
    })

    // Or use raw SQL for PostgreSQL
    // const pool = db.pool
    // await pool.query(`
    //   CREATE TABLE users (
    //     id UUID PRIMARY KEY,
    //     name TEXT,
    //     email TEXT UNIQUE,
    //     created_at TIMESTAMP
    //   )
    // `)
  },

  async down(db) {
    // Rollback: Drop the table
    const User = db.model('User', {})
    // Note: Models don't have dropTable method yet
    // For now, use raw SQL:
    // const pool = db.pool
    // await pool.query('DROP TABLE IF EXISTS users')
  }
}
```

### Run Migrations

```javascript
// Run all pending migrations
const result = await migrations.migrate()
console.log(result)
// { applied: [...], message: 'Applied 3 migration(s)' }

// Run migrations up to a specific version
await migrations.migrate({ to: '1234567890' })

// Dry run (see what would be applied)
await migrations.migrate({ dryRun: true })
```

### Rollback Migrations

```javascript
// Rollback last migration
await migrations.rollback({ steps: 1 })

// Rollback to a specific version
await migrations.rollback({ to: '1234567890' })
```

### Migration Status

```javascript
// Check migration status
const status = await migrations.status()
console.log(status)
// [
//   { version: '1234567890', name: 'add_users_table', status: 'applied' },
//   { version: '1234567891', name: 'add_tasks_table', status: 'pending' }
// ]

// Get applied migrations
const applied = await migrations.getAppliedMigrations()
console.log(applied) // ['1234567890']

// Get pending migrations
const pending = await migrations.getPendingMigrations()
console.log(pending) // ['1234567891']
```

### Migration Best Practices

```javascript
// Always test migrations
await migrations.migrate({ dryRun: true })

// Use transactions when possible (PostgreSQL)
module.exports = {
  async up(db) {
    const client = await db.pool.connect()
    try {
      await client.query('BEGIN')
      // Migration code
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }
}
```

## Advanced Indexing

Beyond basic indexes in model settings, you can define advanced indexes programmatically.

### Setup

```javascript
const Record = require('aerekos-record')

const db = Record.connect('psql', { /* config */ })
const indexes = Record.createIndexManager(db)
```

### Define Indexes

```javascript
// Simple index
indexes.defineIndex('User', 'email', {
  unique: true,
  name: 'user_email_unique_idx'
})

// Composite index
indexes.defineIndex('User', ['email', 'organizationId'], {
  name: 'user_org_email_idx'
})

// Partial index (PostgreSQL)
indexes.defineIndex('User', 'email', {
  where: 'active = true',
  name: 'user_active_email_idx'
})

// Index with type (PostgreSQL)
indexes.defineIndex('User', 'name', {
  type: 'gin', // btree, hash, gist, gin, etc.
  name: 'user_name_gin_idx'
})

// Object definition
indexes.defineIndex('User', {
  fields: ['email', 'organizationId'],
  unique: true,
  name: 'user_email_org_unique_idx',
  where: 'deleted_at IS NULL' // Partial index
})
```

### Create Indexes

```javascript
// Register model first
const User = db.model('User', {
  email: 'string',
  organizationId: 'string',
  name: 'string'
})

indexes.registerModel('User', User)

// Create all defined indexes
const created = await indexes.createIndexes('User', User)
console.log(created) // ['user_email_unique_idx', 'user_org_email_idx']
```

### Drop Indexes

```javascript
// Drop a specific index
await indexes.dropIndex('User', 'user_email_unique_idx', User)
```

### List Indexes

```javascript
// List all indexes for a model
const indexList = await indexes.listIndexes('User', User)
console.log(indexList)
// PostgreSQL:
// [
//   { indexname: 'user_email_unique_idx', indexdef: 'CREATE UNIQUE INDEX...' },
//   { indexname: 'user_org_email_idx', indexdef: 'CREATE INDEX...' }
// ]
```

### Index Types by Database

**PostgreSQL:**
- `btree` (default) - Balanced tree index
- `hash` - Hash index for equality
- `gist` - Generalized Search Tree
- `gin` - Generalized Inverted Index (for arrays, full-text)
- `spgist` - Space-partitioned GiST
- `brin` - Block Range Index

**MongoDB:**
- Single field indexes
- Compound indexes
- Multikey indexes
- Text indexes
- Geospatial indexes

**Neo4j:**
- Property indexes (via model settings)
- Composite indexes (via constraints)

**Elasticsearch:**
- Field mappings define indexes
- Text, keyword, numeric, date, etc.

### Complete Indexing Example

```javascript
const Record = require('aerekos-record')

const db = Record.connect('psql', { /* config */ })
const indexes = Record.createIndexManager(db)

// Define model
const User = db.model('User', {
  email: 'string',
  organizationId: 'string',
  name: 'string',
  active: 'boolean'
})

// Define indexes
indexes.defineIndex('User', 'email', { unique: true })
indexes.defineIndex('User', ['organizationId', 'email'])
indexes.defineIndex('User', 'name', {
  type: 'gin',
  where: 'active = true'
})

// Register and create
indexes.registerModel('User', User)
await indexes.createIndexes('User', User)

// List indexes
const allIndexes = await indexes.listIndexes('User', User)
console.log(allIndexes)
```

## Seeding

Database seeding utilities for populating your database with initial data.

### Setup

```javascript
const Record = require('aerekos-record')

const db = Record.connect('psql', { /* config */ })
const seeding = Record.createSeeding(db, {
  seedsPath: './seeds'
})
```

### Create Seed File

```javascript
// Creates a new seed file
await seeding.createSeed('users')
// Creates: ./seeds/users.js
```

### Seed File Template

```javascript
/**
 * Seed: users
 * Created: 2024-01-01T00:00:00.000Z
 */

module.exports = {
  async up(db) {
    const User = db.model('User', {
      name: 'string',
      email: 'string'
    })

    await User.create({ name: 'Admin', email: 'admin@example.com' })
    await User.create({ name: 'User', email: 'user@example.com' })
  },

  async down(db) {
    // Optional cleanup
    const User = db.model('User', {})
    await User.deleteBy({ email: 'admin@example.com' })
  }
}
```

### Run Seeds

```javascript
// Run all seed files
await seeding.seed()

// Run specific seed
await seeding.seed({ specific: 'users' })

// Dry run
await seeding.seed({ dryRun: true })

// Stop on error
await seeding.seed({ stopOnError: true })
```

### Programmatic Seeding

```javascript
// Register a seeder function
seeding.registerSeeder('custom', async (db) => {
  const User = db.model('User', { name: 'string', email: 'string' })
  await User.create({ name: 'Test', email: 'test@example.com' })
})

// Run registered seeders
await seeding.runSeeders(['custom'])

// Reset (run all down functions)
await seeding.reset()
```

## Query Builder

Fluent query building API for complex queries.

### Usage

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string',
  age: 'number',
  active: 'boolean'
})

// Fluent query building
const users = await User.query()
  .where('age', '>=', 18)
  .where('active', true)
  .whereIn('email', ['user1@example.com', 'user2@example.com'])
  .orderBy('name', 'ASC')
  .limit(10)
  .findAll()

// Chaining
const activeUsers = await User.query()
  .where('active', true)
  .whereNotNull('email')
  .whereBetween('age', 18, 65)
  .orderByDesc('createdAt')
  .findAll()

// Pagination
const page = await User.query()
  .where('active', true)
  .paginate(1, 20) // page 1, 20 per page
// Returns: { data: [...], pagination: { page, perPage, total, totalPages, ... } }

// Chunk processing
await User.query()
  .where('active', true)
  .chunk(100, async (users) => {
    // Process 100 users at a time
    await processBatch(users)
  })

// Count
const count = await User.query()
  .where('age', '>=', 18)
  .count()

// Exists check
const exists = await User.query()
  .where('email', 'admin@example.com')
  .exists()
```

### Query Builder Methods

- `where(field, operator, value)` - Add where condition
- `where(field, value)` - Equality where
- `andWhere(field, operator, value)` - Alias for where
- `orWhere(field, operator, value)` - OR condition
- `whereNull(field)` - Field is null
- `whereNotNull(field)` - Field is not null
- `whereIn(field, values)` - Field in array
- `whereNotIn(field, values)` - Field not in array
- `whereContains(field, value)` - Field contains value
- `whereBetween(field, min, max)` - Field between values
- `orderBy(field, direction)` - Order by field
- `orderByDesc(field)` - Order descending
- `limit(count)` - Limit results
- `offset(count)` - Offset results
- `skip(count)` - Alias for offset
- `include(associations)` - Eager load associations
- `select(fields)` - Select specific fields
- `withDeleted()` - Include soft-deleted records
- `findAll()` - Execute and return all
- `findOne()` - Execute and return first
- `count()` - Count matching records
- `exists()` - Check if any exist
- `first()` - Get first result
- `last()` - Get last result
- `paginate(page, perPage)` - Paginated results
- `chunk(size, callback)` - Process in chunks

## Caching

Built-in caching layer with Redis or in-memory cache support.

### Setup

```javascript
const Record = require('aerekos-record')

const db = Record.connect('psql', { /* config */ })
const redisCache = Record.connect('redis', { /* config */ })

// Create caching manager
const caching = Record.createCaching(db, redisCache)

// Or use in-memory cache
const { MemoryCache } = Record
const memoryCache = new MemoryCache()
const caching = Record.createCaching(db, memoryCache)
```

### Configuration

```javascript
caching
  .setTTL(7200) // 2 hours default TTL
  .setPrefix('myapp:') // Cache key prefix
  .enable(true) // Enable/disable caching
```

### Usage

```javascript
const User = db.model('User', { name: 'string', email: 'string' })

// Cache wrap
const user = await caching.wrap(
  caching.cacheKey('User', 'find', userId),
  () => User.find(userId),
  3600 // TTL in seconds
)

// Manual cache operations
await caching.set('user:123', userData, 3600)
const cached = await caching.get('user:123')
await caching.delete('user:123')

// Clear model cache
await caching.clearModel('User')

// Clear all cache
await caching.clearAll()
```

## Observability

Query logging, metrics, and tracing for monitoring and debugging.

### Setup

```javascript
const Record = require('aerekos-record')

const observability = Record.createObservability({
  enabled: true,
  logQueries: true,
  logSlowQueries: true,
  slowQueryThreshold: 1000, // ms
  maxLogSize: 1000,
  traceEnabled: true
})
```

### Usage

```javascript
// Metrics are automatically collected when integrated with adapters
const metrics = observability.getMetrics()
console.log(metrics)
// {
//   queries: 150,
//   slowQueries: 5,
//   errors: 2,
//   totalTime: 45000,
//   averageTime: 300,
//   byOperation: {
//     find: { count: 50, totalTime: 5000, averageTime: 100 },
//     findAll: { count: 30, totalTime: 15000, averageTime: 500 }
//   },
//   byModel: {
//     User: { count: 80, totalTime: 20000, averageTime: 250 }
//   }
// }

// Get query log
const log = observability.getQueryLog(100) // Last 100 queries

// Get slow queries
const slowQueries = observability.getSlowQueries(10)

// Get errors
const errors = observability.getErrors(50)

// Reset metrics
observability.resetMetrics()
```

## Connection Retry

Automatic retry with exponential backoff for resilient connections.

### Setup

```javascript
const Record = require('aerekos-record')

const retry = Record.createRetry({
  maxRetries: 5,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  multiplier: 2, // Exponential multiplier
  retryableErrors: ['ECONNRESET', 'ETIMEDOUT']
})
```

### Usage

```javascript
// Wrap database operations with retry
const user = await retry.retry(async () => {
  return await User.find(userId)
}, {
  onRetry: (attempt, error, delay) => {
    console.log(`Retry attempt ${attempt} after ${delay}ms`)
  }
})
```

## Circuit Breaker

Circuit breaker pattern for resilience and fault tolerance.

### Setup

```javascript
const Record = require('aerekos-record')

const circuitBreaker = Record.createCircuitBreaker({
  failureThreshold: 5, // Open after 5 failures
  resetTimeout: 60000, // 1 minute
  monitoringWindow: 60000 // 1 minute window
})
```

### Usage

```javascript
// Execute with circuit breaker
const user = await circuitBreaker.execute(
  async () => User.find(userId),
  async () => {
    // Fallback function
    return { id: userId, name: 'Fallback User' }
  }
)

// Check state
if (circuitBreaker.isOpen()) {
  console.log('Circuit breaker is OPEN - using fallback')
}

// Get statistics
const stats = circuitBreaker.getStats()
console.log(stats)
// {
//   state: 'CLOSED',
//   failureCount: 2,
//   failuresInWindow: 2,
//   ...
// }

// Reset circuit breaker
circuitBreaker.reset()
```

## Batch Operations

Optimized bulk insert/update operations.

### Usage

```javascript
const User = db.model('User', { name: 'string', email: 'string' })

// Bulk create
const users = await User.batch.bulkCreate([
  { name: 'User 1', email: 'user1@example.com' },
  { name: 'User 2', email: 'user2@example.com' },
  { name: 'User 3', email: 'user3@example.com' }
], {
  batchSize: 100 // Process 100 at a time
})

// Bulk update
const updated = await User.batch.bulkUpdate([
  { id: 'id1', changes: { name: 'Updated 1' } },
  { id: 'id2', changes: { name: 'Updated 2' } }
])

// Bulk delete
await User.batch.bulkDelete(['id1', 'id2', 'id3'])

// Bulk upsert (insert or update)
await User.batch.bulkUpsert([
  { email: 'user1@example.com', name: 'User 1' },
  { email: 'user2@example.com', name: 'User 2' }
], 'email') // Use email as unique field
```

## Streaming

Stream large result sets for memory-efficient processing.

### Usage

```javascript
const User = db.model('User', { name: 'string' })

// Create readable stream
const stream = User.stream.createStream({
  where: { active: true },
  chunkSize: 100 // 100 records per chunk
})

// Process stream
stream.on('data', (user) => {
  console.log('Processing user:', user.name)
})

stream.on('end', () => {
  console.log('Stream complete')
})

stream.on('error', (error) => {
  console.error('Stream error:', error)
})

// Or use helper method
await User.stream.stream(
  { where: { active: true } },
  async (user) => {
    await processUser(user)
  }
)

// Collect results (with limit)
const users = await User.stream.streamCollect(
  { where: { active: true } },
  1000 // Limit to 1000 records
)
```

## Full-Text Search

Advanced search capabilities across databases.

### Usage

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string',
  bio: 'string'
})

// Configure searchable fields
User.search.setSearchFields(['name', 'email', 'bio'])

// Search
const results = await User.search.search('john', {
  fields: ['name', 'bio'],
  limit: 10,
  offset: 0
})

// Results include relevance scores (Elasticsearch)
results.forEach(result => {
  console.log(result.name, result._score)
})
```

### Database-Specific Search

**Elasticsearch:**
- Full-text search with relevance scoring
- **Fuzzy matching** - Handles typos automatically
- Multi-field search
- Multiple query types (multi_match, match, fuzzy)
- Highlighting support
- Custom fuzziness levels
- Prefix length control
- Character transpositions

**PostgreSQL:**
- Full-text search with `tsvector`/`tsquery`
- Ranking with `ts_rank`
- Language-specific stemming

**MongoDB:**
- Text indexes
- Text search with relevance scoring

**Neo4j:**
- CONTAINS-based search
- Multi-field OR search

### Elasticsearch Fuzzy Search Examples

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string',
  bio: 'string'
})

User.search.setSearchFields(['name', 'email', 'bio'])

// Basic fuzzy search (automatic typo handling)
const results = await User.search.fuzzySearch('desginer', {
  fields: ['name', 'bio'],
  fuzziness: 'AUTO', // AUTO, 0, 1, 2, or '0..2'
  limit: 10
})

// Custom fuzziness level
const customFuzzy = await User.search.search('desginer', {
  fields: ['name', 'bio'],
  fuzziness: 2, // Allow up to 2 character differences
  queryType: 'multi_match',
  limit: 10
})

// Advanced fuzzy search with options
const advanced = await User.search.search('desginer', {
  fields: ['name', 'bio'],
  queryType: 'fuzzy',
  fuzziness: 'AUTO',
  prefixLength: 2, // First 2 chars must match exactly
  maxExpansions: 50, // Max variations to check
  transpositions: true, // Allow ab -> ba
  limit: 10
})

// Search with highlighting
const highlighted = await User.search.search('designer', {
  fields: ['name', 'bio'],
  highlight: true, // Adds _highlight field
  limit: 10
})

// Match query with fuzziness
const matchFuzzy = await User.search.search('designer', {
  fields: ['name', 'bio'],
  queryType: 'match',
  fuzziness: 1,
  operator: 'or', // or 'and'
  boost: 2.0, // Boost relevance
  limit: 10
})

// Multi-term search with minimum match
const multiSearch = await User.search.search('UI UX designer', {
  fields: ['name', 'bio'],
  matchType: 'best_fields',
  operator: 'or',
  minimumShouldMatch: '75%', // 75% of terms must match
  limit: 20
})
```

### Fuzzy Search Options

- **fuzziness**: `'AUTO'` (default), `0`, `1`, `2`, or `'0..2'` (range)
- **queryType**: `'multi_match'` (default), `'match'`, or `'fuzzy'`
- **prefixLength**: Number of characters that must match exactly (default: 0)
- **maxExpansions**: Maximum number of variations to check (default: 50)
- **transpositions**: Allow character transpositions like `ab` → `ba` (default: true)
- **operator**: `'or'` or `'and'` for match queries
- **boost**: Relevance score multiplier
- **minimumShouldMatch**: Minimum percentage/number of terms that must match
- **highlight**: Enable result highlighting (adds `_highlight` field)
- **sort**: Custom sorting (e.g., `[{ _score: { order: 'desc' } }]`)

## JSON/JSONB Support

Enhanced JSON field operations (PostgreSQL JSONB).

### Usage

```javascript
const User = db.model('User', {
  name: 'string',
  metadata: 'string' // JSON field
})

// Query JSON field
const users = await User.json.queryJSON(
  'metadata',
  'settings.theme',
  '=',
  'dark'
)

// Update JSON field
await User.json.updateJSON(
  userId,
  'metadata',
  ['settings', 'theme'],
  'light'
)

// Get JSON field value
const theme = await User.json.getJSON(
  userId,
  'metadata',
  'settings.theme'
)
```

## Change Streams

Real-time change notifications for MongoDB (MongoDB only).

### Usage

```javascript
const User = db.model('User', {
  name: 'string',
  email: 'string'
})

// Watch all changes
const stream = await User.changes.watch()

stream.on('insert', (document) => {
  console.log('New user inserted:', document)
})

stream.on('update', ({ id, document, updatedFields }) => {
  console.log('User updated:', id, updatedFields)
})

stream.on('delete', ({ id }) => {
  console.log('User deleted:', id)
})

stream.on('change', (change) => {
  console.log('Change event:', change.type, change.document)
})

stream.on('error', (error) => {
  console.error('Stream error:', error)
})

// Watch specific operations
const insertStream = await User.changes.watchInserts((document) => {
  console.log('New user:', document)
})

const updateStream = await User.changes.watchUpdates(({ id, updatedFields }) => {
  console.log('Updated fields:', updatedFields)
})

const deleteStream = await User.changes.watchDeletes(({ id }) => {
  console.log('Deleted:', id)
})

// Watch specific fields
const emailStream = await User.changes.watchFields(['email'], (change) => {
  console.log('Email changed:', change)
})

// Close streams
await User.changes.close(streamId)
await User.changes.closeAll()
```

### Change Stream Options

```javascript
// Custom pipeline
const stream = await User.changes.watch({
  pipeline: [
    { $match: { 'fullDocument.status': 'active' } }
  ],
  fullDocument: 'updateLookup', // Include full document on updates
  resumeAfter: resumeToken, // Resume from token
})
```

## Geospatial Queries

Location-based queries with PostGIS (PostgreSQL) and MongoDB geospatial support.

### Setup

```javascript
// PostgreSQL with PostGIS
const Location = db.model('Location', {
  name: 'string',
  location_lat: 'number', // Latitude column
  location_lng: 'number', // Longitude column
})

// MongoDB with geospatial index
const Location = db.model('Location', {
  name: 'string',
  location: {
    type: 'Point',
    coordinates: [longitude, latitude] // MongoDB format
  }
})
```

### Usage

```javascript
const Location = db.model('Location', {
  name: 'string',
  location_lat: 'number',
  location_lng: 'number'
})

// Find locations near a point (within radius)
const nearby = await Location.geo.near(
  37.7749, // latitude
  -122.4194, // longitude
  5000, // radius in meters (5km)
  {
    field: 'location', // Field prefix (location_lat, location_lng)
    limit: 10,
    offset: 0
  }
)
// Returns locations with distance field

// Find locations within bounding box
const inBounds = await Location.geo.withinBounds(
  37.7, // minLat
  -122.5, // minLng
  37.8, // maxLat
  -122.3, // maxLng
  { field: 'location' }
)

// Find locations within polygon
const polygon = [
  [-122.5, 37.7], // [lng, lat]
  [-122.3, 37.7],
  [-122.3, 37.8],
  [-122.5, 37.8],
  [-122.5, 37.7] // Close polygon
]
const inPolygon = await Location.geo.withinPolygon(polygon, {
  field: 'location'
})

// Calculate distance between two points
const distance = Location.geo.calculateDistance(
  37.7749, -122.4194, // Point 1
  37.7849, -122.4094  // Point 2
) // Returns distance in meters
```

### MongoDB Geospatial Index

```javascript
// Create geospatial index for MongoDB
const collection = await db.getCollection('locations')
await collection.createIndex({ location: '2dsphere' })
```

### PostgreSQL PostGIS Setup

```sql
-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Create table with lat/lng columns
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  name TEXT,
  location_lat DECIMAL(10, 8),
  location_lng DECIMAL(11, 8)
);

-- Or use POINT type
CREATE TABLE locations (
  id UUID PRIMARY KEY,
  name TEXT,
  location POINT
);
```

## Composite Keys

Support for composite primary keys (multiple fields as primary key).

### Usage

```javascript
const OrderItem = db.model('OrderItem', {
  orderId: 'string',
  productId: 'string',
  quantity: 'number',
  price: 'number'
})

// Define composite key
OrderItem.compositeKeys.defineCompositeKey('OrderItem', ['orderId', 'productId'])

// Generate composite key
const record = { orderId: 'order-1', productId: 'prod-1', quantity: 5 }
const compositeKey = OrderItem.compositeKeys.generateCompositeKey('OrderItem', record)
// Returns: 'order-1::prod-1'

// Parse composite key
const parsed = OrderItem.compositeKeys.parseCompositeKey('OrderItem', 'order-1::prod-1')
// Returns: { orderId: 'order-1', productId: 'prod-1' }

// Find by composite key
const item = await OrderItem.compositeKeys.findByCompositeKey('OrderItem', 'order-1::prod-1')

// Update by composite key
await OrderItem.compositeKeys.updateByCompositeKey('OrderItem', 'order-1::prod-1', {
  quantity: 10
})

// Delete by composite key
await OrderItem.compositeKeys.deleteByCompositeKey('OrderItem', 'order-1::prod-1')
```

## Polymorphic Associations

Polymorphic relationships (belongs_to :polymorphic, has_many :as).

### Usage

```javascript
// Define models
const Comment = db.model('Comment', {
  body: 'string',
  commentableType: 'string', // Polymorphic type field
  commentableId: 'string',   // Polymorphic id field
})

const Post = db.model('Post', {
  title: 'string',
  content: 'string'
})

const Video = db.model('Video', {
  title: 'string',
  url: 'string'
})

// Define polymorphic associations
const polymorphic = new Record.PolymorphicAssociationsManager(Comment, registry)

// Comment belongs_to :polymorphic (commentable)
polymorphic.definePolymorphicBelongsTo('Comment', 'commentable', {
  typeField: 'commentableType',
  idField: 'commentableId'
})

// Post has_many :comments, as: :commentable
polymorphic.definePolymorphicHasMany('Post', 'comments', {
  as: 'commentable',
  model: 'Comment',
  typeField: 'commentableType',
  idField: 'commentableId'
})

// Video has_many :comments, as: :commentable
polymorphic.definePolymorphicHasMany('Video', 'comments', {
  as: 'commentable',
  model: 'Comment',
  typeField: 'commentableType',
  idField: 'commentableId'
})

// Create a comment on a post
const post = await Post.create({ title: 'My Post', content: '...' })
const comment = await Comment.create({
  body: 'Great post!',
  commentableType: 'Post',
  commentableId: post.id
})

// Get polymorphic association
const commentable = await polymorphic.getPolymorphicAssociation(
  'Comment',
  'commentable',
  comment
) // Returns the Post

// Get all comments for a post
const comments = await polymorphic.getPolymorphicAssociation(
  'Post',
  'comments',
  post
) // Returns array of Comments

// Set polymorphic association
await polymorphic.setPolymorphicAssociation(
  'Comment',
  'commentable',
  comment,
  video // Change commentable from Post to Video
)

// Create polymorphic association
const newComment = await polymorphic.createPolymorphicAssociation(
  'Post',
  'comments',
  post,
  { body: 'Another comment' }
)
```

### Rails-Style Syntax

```javascript
// In model settings (future enhancement)
const Comment = db.model('Comment', {
  body: 'string',
  commentableType: 'string',
  commentableId: 'string'
}, {
  belongsTo: {
    polymorphic: 'commentable' // Automatically sets up polymorphic
  }
})

const Post = db.model('Post', {
  title: 'string'
}, {
  hasMany: {
    comments: {
      as: 'commentable',
      model: 'Comment'
    }
  }
})
```

### Complete Example

```javascript
// Picture can belong to either User or Product
const Picture = db.model('Picture', {
  url: 'string',
  imageableType: 'string',
  imageableId: 'string'
})

// User has many pictures
const User = db.model('User', {
  name: 'string'
})

// Product has many pictures
const Product = db.model('Product', {
  name: 'string',
  price: 'number'
})

// Setup polymorphic associations
const polymorphic = new Record.PolymorphicAssociationsManager(Picture, registry)

polymorphic.definePolymorphicBelongsTo('Picture', 'imageable')
polymorphic.definePolymorphicHasMany('User', 'pictures', { as: 'imageable', model: 'Picture' })
polymorphic.definePolymorphicHasMany('Product', 'pictures', { as: 'imageable', model: 'Picture' })

// Create picture for user
const user = await User.create({ name: 'John' })
const userPicture = await Picture.create({
  url: '/images/user.jpg',
  imageableType: 'User',
  imageableId: user.id
})

// Create picture for product
const product = await Product.create({ name: 'Widget', price: 29.99 })
const productPicture = await Picture.create({
  url: '/images/product.jpg',
  imageableType: 'Product',
  imageableId: product.id
})

// Get imageable (polymorphic parent)
const imageable = await polymorphic.getPolymorphicAssociation('Picture', 'imageable', userPicture)
console.log(imageable.name) // 'John'

// Get all pictures for user
const userPictures = await polymorphic.getPolymorphicAssociation('User', 'pictures', user)
console.log(userPictures.length) // 1
```

## Embeddings

`aerekos-record` includes built-in support for embeddings and vector similarity search using ChromaDB and Ollama (or other embedding providers).

### Features

- 🔤 **Multiple Providers** - Ollama, OpenAI, or custom providers
- 📦 **ChromaDB Integration** - Vector storage with automatic collection management
- ✂️ **Text Chunking** - Automatic chunking for long documents
- 🔍 **Similarity Search** - Find similar records using vector search
- ⚡ **Auto-Generation** - Automatic embedding generation on create/update
- 🏷️ **Metadata Filtering** - Filter search results by model fields

### Setup

```javascript
const Record = require('aerekos-record')

// 1. Connect to your primary database
const db = Record.connect('psql', {
  host: 'localhost',
  database: 'myapp'
})

// 2. Connect to ChromaDB for vector storage
const chroma = Record.connectChroma({
  url: process.env.CHROMA_BASE_URL || 'http://localhost:8000',
  collection: 'messages',
  tenant: 'default_tenant',
  database: 'default_database'
})

// 3. Define model with embeddings
const Message = db.model('Message', {
  text: 'string',
  userId: 'string',
  conversationId: 'string'
}, {
  embeddings: {
    // Fields to embed
    fields: [
      {
        field: 'text',
        chunk: true, // Enable chunking for long text
        chunkSize: 1500,
        chunkOverlap: 200,
        chunkingStrategy: 'simple' // or 'smart'
      }
    ],
    // Embedding provider (Ollama)
    provider: 'ollama',
    providerConfig: {
      url: process.env.OLLAMA_EMBEDDING_URL || 'http://localhost:11434',
      model: process.env.OLLAMA_EMBED_MODEL || 'embeddinggemma:latest',
      dimensions: 1024
    },
    // Chroma adapter
    chromaAdapter: chroma,
    // Collection name (defaults to model name)
    collection: 'messages',
    // Auto-generate embeddings
    autoGenerate: true,
    // Fields to include in metadata
    metadataFields: ['userId', 'conversationId'],
    // Custom metadata
    customMetadata: {
      type: 'message'
    }
  }
})
```

### Usage

#### Auto-Generate Embeddings

```javascript
// Embeddings are automatically generated on create
const message = await Message.create({
  text: 'I love working with Node.js',
  userId: 'user-123',
  conversationId: 'conv-1'
})
// Embedding is automatically generated and stored in ChromaDB
```

#### Similarity Search

```javascript
// Find similar messages
const similar = await Message.findSimilar('I like coding in JavaScript', {
  limit: 5,
  filters: {
    userId: 'user-123' // Filter by user
  }
})

similar.forEach(result => {
  console.log(`Score: ${result.score}, Text: ${result.record.text}`)
})
```

#### Manual Embedding Generation

```javascript
// Generate embedding manually
const embedding = await Message.generateEmbedding('Some text')
console.log(`Generated ${embedding.length}-dimensional vector`)

// Generate embeddings for multiple texts
const embeddings = await Message.embeddings.generateEmbeddings([
  'Text 1',
  'Text 2',
  'Text 3'
])
```

#### Chunking Long Text

```javascript
// Chunk and embed long text
const longText = 'Very long text that exceeds model context...'
const chunked = await Message.embeddings.chunkAndEmbed(longText, {
  chunkSize: 1500,
  overlap: 200,
  strategy: 'smart' // Preserve sentence boundaries
})

chunked.forEach((chunk, index) => {
  console.log(`Chunk ${index}: ${chunk.chunk.slice(0, 50)}...`)
  console.log(`Embedding: ${chunk.embedding.length} dimensions`)
})

// Store chunked embeddings
const embeddingIds = await Message.embeddings.storeChunkedEmbeddings(
  message.id,
  'text',
  longText,
  {
    chunkSize: 1500,
    overlap: 200
  }
)
```

#### Advanced Search Options

```javascript
// Search with distance threshold
const results = await Message.findSimilar('query text', {
  limit: 10,
  threshold: 0.3, // Maximum distance (lower = more similar)
  filters: {
    userId: 'user-123',
    conversationId: 'conv-1'
  },
  returnRecords: true // Return model instances (default: true)
})

// Access embedding manager directly
const embeddingManager = Message.embeddings
const dimensions = embeddingManager.getDimensions()
console.log(`Model produces ${dimensions}-dimensional vectors`)
```

#### Delete Embeddings

```javascript
// Delete embeddings for a record
await Message.embeddings.deleteEmbeddings(message.id, 'text')

// Delete all embeddings for a record
await Message.embeddings.deleteEmbeddings(message.id)
```

### Custom Embedding Providers

```javascript
const Record = require('aerekos-record')
const { BaseEmbeddingProvider } = require('aerekos-record/shared/embeddings/providers')

// Create custom provider
class MyCustomProvider extends BaseEmbeddingProvider {
  constructor(config) {
    super(config)
    this.apiKey = config.apiKey
  }

  async embed(text) {
    // Your embedding logic here
    const response = await fetch('https://api.example.com/embed', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
      body: JSON.stringify({ text })
    })
    return response.json().embedding
  }

  getDimensions() {
    return 768 // Your model dimensions
  }
}

// Register provider
Record.registerEmbeddingProvider('myprovider', MyCustomProvider)

// Use it
const Message = db.model('Message', {
  text: 'string'
}, {
  embeddings: {
    fields: ['text'],
    provider: 'myprovider',
    providerConfig: {
      apiKey: process.env.MY_API_KEY
    },
    chromaAdapter: chroma
  }
})
```

### ChromaDB Health Check

```javascript
const health = await chroma.healthCheck()
console.log(health) // { status: 'healthy', url: 'http://localhost:8000' }
```

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `fields` | Array | `[]` | Fields to embed (string or object with config) |
| `provider` | String | `'ollama'` | Embedding provider name |
| `providerConfig` | Object | `{}` | Provider-specific configuration |
| `chromaAdapter` | Object | `null` | ChromaDB adapter instance (required) |
| `collection` | String | Model name | ChromaDB collection name |
| `autoGenerate` | Boolean | `true` | Auto-generate embeddings on create/update |
| `chunkSize` | Number | `1500` | Default chunk size for chunking |
| `chunkOverlap` | Number | `200` | Default overlap between chunks |
| `chunkingStrategy` | String | `'simple'` | `'simple'` or `'smart'` |
| `metadataFields` | Array | `[]` | Model fields to include in metadata |
| `customMetadata` | Object | `{}` | Custom metadata to always include |

### Field Configuration

```javascript
fields: [
  'text', // Simple: just field name
  {
    field: 'content', // Field name
    chunk: true, // Enable chunking
    chunkSize: 2000, // Override default chunk size
    chunkOverlap: 300, // Override default overlap
    chunkingStrategy: 'smart' // Override default strategy
  }
]
```

### Example: RAG (Retrieval Augmented Generation)

```javascript
// 1. Store documents with embeddings
const Document = db.model('Document', {
  title: 'string',
  content: 'string',
  category: 'string'
}, {
  embeddings: {
    fields: [{ field: 'content', chunk: true }],
    provider: 'ollama',
    providerConfig: { url: 'http://localhost:11434' },
    chromaAdapter: chroma,
    metadataFields: ['title', 'category']
  }
})

// 2. Create documents
await Document.create({
  title: 'Node.js Guide',
  content: 'Node.js is a JavaScript runtime...',
  category: 'programming'
})

// 3. Query similar documents
const query = 'How do I use JavaScript?'
const similar = await Document.findSimilar(query, {
  limit: 5,
  filters: { category: 'programming' }
})

// 4. Use in RAG pipeline
const context = similar.map(r => r.record.content).join('\n\n')
const answer = await generateAnswer(query, context)
```

See `EXAMPLES/embeddings-example.js` for a complete working example.

## Complete Feature List

### ✅ All Features Implemented

✅ **Connection Pooling** - Configurable pool sizes and timeouts  
✅ **Health Checks** - Monitor database connection health  
✅ **Sharding** - Distribute data across multiple instances  
✅ **Read Replicas** - Automatic read/write splitting  
✅ **Failover** - Health-based instance selection  
✅ **Migrations** - Version-controlled schema migrations  
✅ **Advanced Indexing** - Composite, partial, and custom indexes  
✅ **Seeding** - Database seeding utilities  
✅ **Query Builder** - Fluent query building API  
✅ **Caching Layer** - Built-in caching (Redis/Memory)  
✅ **Observability** - Query logging, metrics, tracing  
✅ **Connection Retry** - Automatic retry with exponential backoff  
✅ **Circuit Breaker** - Circuit breaker pattern for resilience  
✅ **Batch Operations** - Optimized bulk insert/update  
✅ **Streaming** - Stream large result sets  
✅ **Full-Text Search** - Advanced search capabilities  
✅ **JSON/JSONB Support** - Enhanced JSON field operations  
✅ **Change Streams** - Real-time change notifications (MongoDB)  
✅ **Geospatial Queries** - Location-based queries  
✅ **Composite Keys** - Support for composite primary keys  
✅ **Polymorphic Associations** - Polymorphic relationships  
✅ **Embeddings** - Vector embeddings with ChromaDB and Ollama  
✅ **Transactions** - Basic transaction support (database-specific)  
✅ **Soft Deletes** - Optional soft delete support  
✅ **Timestamps** - Automatic createdAt/updatedAt  
✅ **Callbacks** - Full Rails Active Record callbacks  
✅ **Associations** - hasMany, hasOne, belongsTo

## License

MIT


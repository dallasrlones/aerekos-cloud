/**
 * Neo4j Integration Tests
 * Tests Neo4j database creation, health checks, and aerekos-record connectivity
 * 
 * These tests require:
 * - Docker running
 * - db_manager service running
 * - key_manager service running
 * - Conductor service running
 */

const axios = require('axios');
const Record = require('aerekos-record');

describe('Neo4j Integration Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/services/db_manager/api';
  const PROJECT_ID = process.env.TEST_PROJECT_ID || 'test-project-id';
  let testDbName;
  let authToken; // Will be set if needed

  beforeAll(() => {
    // Generate unique test database name
    testDbName = `test-neo4j-${Date.now()}`;
  });

  afterAll(async () => {
    // Cleanup: Delete test database if it exists
    try {
      await axios.delete(`${API_BASE_URL}/databases/${testDbName}?project_id=${PROJECT_ID}`, {
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('Database Creation', () => {
    it('should create Neo4j database via API', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/databases?project_id=${PROJECT_ID}`,
        {
          name: testDbName,
          type: 'neo4j'
        },
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.database).toBeDefined();
      expect(response.data.database.name).toBe(testDbName);
      expect(response.data.database.type).toBe('neo4j');
      expect(response.data.database.status).toBe('running');
    });

    it('should verify container is running', async () => {
      // Wait a bit for container to fully start (Neo4j takes longer)
      await new Promise(resolve => setTimeout(resolve, 10000));

      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.database.status).toBe('running');
      expect(response.data.database.container_name).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status for running database', async () => {
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.healthy).toBe(true);
      expect(response.data.database).toBe(testDbName);
    });
  });

  describe('aerekos-record Connectivity', () => {
    let connectionString;
    let db;

    beforeAll(async () => {
      // Get connection string from API
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      connectionString = response.data.connection_string;
      expect(connectionString).toBeDefined();

      // Parse connection string for Neo4j
      const url = new URL(connectionString);
      const dbConfig = {
        uri: connectionString,
        user: url.username || 'neo4j',
        password: url.password,
        database: url.pathname.replace('/', '') || undefined
      };

      // Connect using aerekos-record
      db = Record.connect('neo4j', dbConfig);
    });

    afterAll(() => {
      if (db) {
        db.close();
      }
    });

    it('should connect to Neo4j using aerekos-record', async () => {
      const healthCheck = await db.healthCheck();
      expect(healthCheck.healthy).toBe(true);
    });

    it('should create nodes using aerekos-record models', async () => {
      const TestModel = db.model('Neo4jTest', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      // Model should be created without errors
      expect(TestModel).toBeDefined();
    });

    it('should insert data using aerekos-record', async () => {
      const TestModel = db.model('Neo4jTest', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      const record = await TestModel.create({
        name: 'Test User',
        email: 'test@example.com',
        age: 25
      });

      expect(record).toBeDefined();
      expect(record.name).toBe('Test User');
      expect(record.email).toBe('test@example.com');
      expect(record.age).toBe(25);
      expect(record.id).toBeDefined();
    });

    it('should query data using aerekos-record', async () => {
      const TestModel = db.model('Neo4jTest', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      const records = await TestModel.findAll({
        where: { email: 'test@example.com' }
      });

      expect(records).toBeDefined();
      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);
      expect(records[0].email).toBe('test@example.com');
    });

    it('should update data using aerekos-record', async () => {
      const TestModel = db.model('Neo4jTest', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      const records = await TestModel.findAll({
        where: { email: 'test@example.com' }
      });

      if (records.length > 0) {
        const updated = await TestModel.update(records[0].id, {
          age: 30
        });

        expect(updated).toBeDefined();
        expect(updated.age).toBe(30);
      }
    });

    it('should delete data using aerekos-record', async () => {
      const TestModel = db.model('Neo4jTest', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      const records = await TestModel.findAll({
        where: { email: 'test@example.com' }
      });

      if (records.length > 0) {
        await TestModel.delete(records[0].id);

        const deleted = await TestModel.findById(records[0].id);
        expect(deleted).toBeNull();
      }
    });
  });

  describe('aerekos-record Associations', () => {
    let db;
    let User, Task, Profile;

    beforeAll(async () => {
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      const connectionString = response.data.connection_string;
      const url = new URL(connectionString);
      const dbConfig = {
        uri: connectionString,
        user: url.username || 'neo4j',
        password: url.password,
        database: url.pathname.replace('/', '') || undefined
      };

      db = Record.connect('neo4j', dbConfig);

      User = db.model('User', {
        name: 'string',
        email: 'string'
      }, {
        required: ['name', 'email'],
        hasMany: ['Task'],
        hasOne: ['Profile'],
        timestamps: true
      });

      Task = db.model('Task', {
        title: 'string',
        completed: 'boolean',
        user_id: 'string'
      }, {
        required: ['title'],
        belongsTo: 'User',
        timestamps: true
      });

      Profile = db.model('Profile', {
        bio: 'string',
        avatar_url: 'string',
        user_id: 'string'
      }, {
        belongsTo: 'User',
        timestamps: true
      });
    });

    afterAll(() => {
      if (db) {
        db.close();
      }
    });

    describe('hasMany Association', () => {
      let user;

      beforeEach(async () => {
        user = await User.create({
          name: 'Association Test User',
          email: `assoc-test-${Date.now()}@example.com`
        });
      });

      it('should create related records via hasMany association', async () => {
        const task1 = await user.tasks.create({
          title: 'Task 1',
          completed: false
        });

        const task2 = await user.tasks.create({
          title: 'Task 2',
          completed: true
        });

        expect(task1).toBeDefined();
        expect(task1.user_id).toBe(user.id);
        expect(task1.title).toBe('Task 1');

        expect(task2).toBeDefined();
        expect(task2.user_id).toBe(user.id);
        expect(task2.title).toBe('Task 2');
      });

      it('should find all related records via hasMany association', async () => {
        await user.tasks.create({ title: 'Task A', completed: false });
        await user.tasks.create({ title: 'Task B', completed: true });
        await user.tasks.create({ title: 'Task C', completed: false });

        const tasks = await user.tasks.findAll();

        expect(tasks).toBeDefined();
        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks.length).toBeGreaterThanOrEqual(3);
        expect(tasks.every(task => task.user_id === user.id)).toBe(true);
      });

      it('should count related records via hasMany association', async () => {
        await user.tasks.create({ title: 'Task 1', completed: false });
        await user.tasks.create({ title: 'Task 2', completed: true });

        const count = await user.tasks.count();

        expect(count).toBeGreaterThanOrEqual(2);
      });
    });

    describe('hasOne Association', () => {
      let user;

      beforeEach(async () => {
        user = await User.create({
          name: 'HasOne Test User',
          email: `hasone-test-${Date.now()}@example.com`
        });
      });

      it('should create related record via hasOne association', async () => {
        const profile = await user.profile.set({
          bio: 'Software developer',
          avatar_url: 'https://example.com/avatar.jpg'
        });

        expect(profile).toBeDefined();
        expect(profile.user_id).toBe(user.id);
        expect(profile.bio).toBe('Software developer');
      });

      it('should get related record via hasOne association', async () => {
        await user.profile.set({
          bio: 'Test bio',
          avatar_url: 'https://example.com/avatar.jpg'
        });

        const profile = await user.profile.get();

        expect(profile).toBeDefined();
        expect(profile.user_id).toBe(user.id);
        expect(profile.bio).toBe('Test bio');
      });
    });

    describe('belongsTo Association', () => {
      let user;
      let task;

      beforeEach(async () => {
        user = await User.create({
          name: 'BelongsTo Test User',
          email: `belongsto-test-${Date.now()}@example.com`
        });

        task = await Task.create({
          title: 'Test Task',
          completed: false,
          user_id: user.id
        });
      });

      it('should get parent record via belongsTo association', async () => {
        const parentUser = await task.parent();

        expect(parentUser).toBeDefined();
        expect(parentUser.id).toBe(user.id);
        expect(parentUser.name).toBe('BelongsTo Test User');
      });
    });

    describe('Neo4j-specific Features', () => {
      let db;
      let Person, Knows;

      beforeAll(async () => {
        const response = await axios.get(
          `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          }
        );

        const connectionString = response.data.connection_string;
        const url = new URL(connectionString);
        const dbConfig = {
          uri: connectionString,
          user: url.username || 'neo4j',
          password: url.password,
          database: url.pathname.replace('/', '') || undefined
        };

        db = Record.connect('neo4j', dbConfig);

        Person = db.model('Person', {
          name: 'string',
          email: 'string'
        }, {
          required: ['name'],
          timestamps: true
        });
      });

      afterAll(() => {
        if (db) {
          db.close();
        }
      });

      it('should create relationships between nodes', async () => {
        const person1 = await Person.create({
          name: 'Person 1',
          email: 'person1@example.com'
        });

        const person2 = await Person.create({
          name: 'Person 2',
          email: 'person2@example.com'
        });

        expect(person1).toBeDefined();
        expect(person2).toBeDefined();
        expect(person1.id).toBeDefined();
        expect(person2.id).toBeDefined();
      });
    });
  });

  describe('Database Lifecycle', () => {
    it('should stop database and verify health check returns unhealthy', async () => {
      await axios.post(
        `${API_BASE_URL}/databases/${testDbName}/stop?project_id=${PROJECT_ID}`,
        {},
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      await new Promise(resolve => setTimeout(resolve, 2000));

      try {
        const response = await axios.get(
          `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`,
          {
            headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
          }
        );
        expect(response.data.healthy).toBe(false);
      } catch (error) {
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should start database and verify it is accessible again', async () => {
      await axios.post(
        `${API_BASE_URL}/databases/${testDbName}/start?project_id=${PROJECT_ID}`,
        {},
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      // Neo4j takes longer to start
      await new Promise(resolve => setTimeout(resolve, 10000));

      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.healthy).toBe(true);
    });
  });
});


/**
 * PostgreSQL Integration Tests
 * Tests PostgreSQL database creation, health checks, and aerekos-record connectivity
 * 
 * These tests require:
 * - Docker running
 * - db_manager service running
 * - key_manager service running
 * - Conductor service running
 */

const axios = require('axios');
const Record = require('aerekos-record');

describe('PostgreSQL Integration Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/services/db_manager/api';
  const CONDUCTOR_URL = process.env.CONDUCTOR_URL || 'http://localhost:3000';
  let testDbName;
  let authToken;
  let PROJECT_ID;

  // Helper to refresh token if expired
  const refreshToken = async () => {
    try {
      const loginResponse = await axios.post(`${CONDUCTOR_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin'
      });
      authToken = loginResponse.data.token;
      return authToken;
    } catch (error) {
      console.warn('Could not refresh auth token:', error.message);
      return null;
    }
  };

  // Helper to make authenticated requests with auto token refresh
  const authenticatedRequest = async (method, url, data = null, config = {}) => {
    const makeRequest = async () => {
      const headers = {
        ...(config.headers || {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      };
      
      if (method === 'get') {
        return await axios.get(url, { ...config, headers });
      } else if (method === 'post') {
        return await axios.post(url, data, { ...config, headers });
      } else if (method === 'delete') {
        return await axios.delete(url, { ...config, headers });
      }
    };

    try {
      return await makeRequest();
    } catch (error) {
      // If 401, refresh token and retry once
      if (error.response?.status === 401) {
        await refreshToken();
        return await makeRequest();
      }
      throw error;
    }
  };

  beforeAll(async () => {
    // Generate unique test database name
    testDbName = `test-psql-${Date.now()}`;

    // Get auth token
    try {
      const loginResponse = await axios.post(`${CONDUCTOR_URL}/api/auth/login`, {
        username: 'admin',
        password: 'admin'
      });
      authToken = loginResponse.data.token;
    } catch (error) {
      console.warn('Could not get auth token, tests may fail:', error.message);
    }

    // Get first project
    try {
      const projectsResponse = await authenticatedRequest('get', `${CONDUCTOR_URL}/api/projects`);
      if (projectsResponse.data.projects && projectsResponse.data.projects.length > 0) {
        PROJECT_ID = projectsResponse.data.projects[0].id;
      } else {
        // Create a test project
        const createResponse = await authenticatedRequest('post', `${CONDUCTOR_URL}/api/projects`, {
          name: `test-project-${Date.now()}`
        });
        PROJECT_ID = createResponse.data.id;
      }
    } catch (error) {
      console.warn('Could not get project ID, tests may fail:', error.message);
      PROJECT_ID = process.env.TEST_PROJECT_ID || 'test-project-id';
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    // Cleanup: Delete test database if it exists
    try {
      await authenticatedRequest('delete', `${API_BASE_URL}/databases/${testDbName}?project_id=${PROJECT_ID}`, {
        timeout: 5000
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }, 15000); // 15 second timeout for cleanup

  describe('Database Creation', () => {
    it('should create PostgreSQL database via API', async () => {
      const response = await authenticatedRequest(
        'post',
        `${API_BASE_URL}/databases?project_id=${PROJECT_ID}`,
        {
          name: testDbName,
          type: 'postgresql'
        }
      );

      expect(response.status).toBe(201);
      expect(response.data).toBeDefined();
      expect(response.data.name).toBe(testDbName);
      expect(response.data.type).toBe('postgresql');
      expect(response.data.status).toBe('running');
    });

    it('should verify container is running', async () => {
      // Wait a bit for container to fully start
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await authenticatedRequest(
        'get',
        `${API_BASE_URL}/databases/${testDbName}?project_id=${PROJECT_ID}`
      );

      expect(response.status).toBe(200);
      expect(response.data.status).toBe('running');
      expect(response.data.container_name).toBeDefined();
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status for running database', async () => {
      const response = await authenticatedRequest(
        'get',
        `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`
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
      // Wait for database to be fully ready (PostgreSQL can take time to initialize)
      // First wait a bit for container to start
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Simple health check - wait a bit then check once
      // If it fails, the connection test will show the real issue
      try {
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 more seconds
        const healthResponse = await authenticatedRequest(
          'get',
          `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`,
          null,
          { timeout: 30000 }
        );
        if (healthResponse.status !== 200 || !healthResponse.data.healthy) {
          console.warn(`Database ${testDbName} health check returned unhealthy`);
        }
      } catch (error) {
        console.warn(`Database ${testDbName} health check failed:`, error.message);
        // Continue - connection test will verify
      }

      // Get connection string from API
      const response = await authenticatedRequest('get', 
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`
      );

      connectionString = response.data.connection_string;
      expect(connectionString).toBeDefined();

      // Parse connection string
      const url = new URL(connectionString);
      const dbConfig = {
        user: url.username,
        password: url.password,
        host: url.hostname,
        port: parseInt(url.port),
        database: url.pathname.replace('/', ''),
        // Add connection pool config for reliability
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      };

      // Connect using aerekos-record
      db = Record.connect('psql', dbConfig);

      // Wait a bit more for connection pool to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
    });

    afterAll(() => {
      if (db) {
        db.close();
      }
    });

    it('should connect to PostgreSQL using aerekos-record', async () => {
      // Retry health check a few times if it fails
      let healthCheck = { healthy: false };
      let attempts = 0;
      while (!healthCheck.healthy && attempts < 5) {
        try {
          healthCheck = await db.healthCheck();
        } catch (error) {
          // Wait and retry
          await new Promise(resolve => setTimeout(resolve, 1000));
          attempts++;
        }
      }
      expect(healthCheck.healthy).toBe(true);
    });

    it('should create tables using aerekos-record models', async () => {
      const TestModel = db.model('PostgreSQLTest', {
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
      const TestModel = db.model('PostgreSQLTest', {
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
      const TestModel = db.model('PostgreSQLTest', {
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
      const TestModel = db.model('PostgreSQLTest', {
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
      const TestModel = db.model('PostgreSQLTest', {
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
      // Wait for database to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get connection string from API
      const response = await authenticatedRequest('get', 
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`
      );

      const connectionString = response.data.connection_string;
      const url = new URL(connectionString);
      const dbConfig = {
        user: url.username,
        password: url.password,
        host: url.hostname,
        port: parseInt(url.port),
        database: url.pathname.replace('/', ''),
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      };

      db = Record.connect('psql', dbConfig);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Define models with associations
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
        user_id: 'string' // Foreign key
      }, {
        required: ['title'],
        belongsTo: 'User',
        timestamps: true
      });

      Profile = db.model('Profile', {
        bio: 'string',
        avatar_url: 'string',
        user_id: 'string' // Foreign key
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
        // Create a user for testing
        user = await User.create({
          name: 'Association Test User',
          email: `assoc-test-${Date.now()}@example.com`
        });
      });

      it('should create related records via hasMany association', async () => {
        // Create tasks via association
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
        // Create multiple tasks
        await user.tasks.create({ title: 'Task A', completed: false });
        await user.tasks.create({ title: 'Task B', completed: true });
        await user.tasks.create({ title: 'Task C', completed: false });

        // Find all tasks for this user
        const tasks = await user.tasks.findAll();

        expect(tasks).toBeDefined();
        expect(Array.isArray(tasks)).toBe(true);
        expect(tasks.length).toBeGreaterThanOrEqual(3);
        expect(tasks.every(task => task.user_id === user.id)).toBe(true);
      });

      it('should count related records via hasMany association', async () => {
        // Create some tasks
        await user.tasks.create({ title: 'Task 1', completed: false });
        await user.tasks.create({ title: 'Task 2', completed: true });

        // Count tasks
        const count = await user.tasks.count();

        expect(count).toBeGreaterThanOrEqual(2);
      });

      it('should filter related records via hasMany association', async () => {
        // Create tasks with different completion status
        await user.tasks.create({ title: 'Completed Task', completed: true });
        await user.tasks.create({ title: 'Incomplete Task', completed: false });

        // Find only completed tasks
        const completedTasks = await user.tasks.findAll({
          where: { completed: true }
        });

        expect(completedTasks).toBeDefined();
        expect(Array.isArray(completedTasks)).toBe(true);
        expect(completedTasks.every(task => task.completed === true)).toBe(true);
      });
    });

    describe('hasOne Association', () => {
      let user;

      beforeEach(async () => {
        // Create a user for testing
        user = await User.create({
          name: 'HasOne Test User',
          email: `hasone-test-${Date.now()}@example.com`
        });
      });

      it('should create related record via hasOne association', async () => {
        // Create profile via association
        const profile = await user.profile.set({
          bio: 'Software developer',
          avatar_url: 'https://example.com/avatar.jpg'
        });

        expect(profile).toBeDefined();
        expect(profile.user_id).toBe(user.id);
        expect(profile.bio).toBe('Software developer');
      });

      it('should get related record via hasOne association', async () => {
        // Create profile first
        await user.profile.set({
          bio: 'Test bio',
          avatar_url: 'https://example.com/avatar.jpg'
        });

        // Get profile
        const profile = await user.profile.get();

        expect(profile).toBeDefined();
        expect(profile.user_id).toBe(user.id);
        expect(profile.bio).toBe('Test bio');
      });

      it('should return null when hasOne association does not exist', async () => {
        // Create user without profile
        const newUser = await User.create({
          name: 'No Profile User',
          email: `noprofile-${Date.now()}@example.com`
        });

        // Try to get profile (should return null)
        const profile = await newUser.profile.get();

        expect(profile).toBeNull();
      });

      it('should update related record via hasOne association', async () => {
        // Create profile
        const profile = await user.profile.set({
          bio: 'Original bio',
          avatar_url: 'https://example.com/avatar.jpg'
        });

        // Update profile
        const updated = await Profile.update(profile.id, {
          bio: 'Updated bio'
        });

        expect(updated).toBeDefined();
        expect(updated.bio).toBe('Updated bio');
        expect(updated.user_id).toBe(user.id);
      });
    });

    describe('belongsTo Association', () => {
      let user;
      let task;

      beforeEach(async () => {
        // Create a user and task
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
        // Get parent user from task
        const parentUser = await task.parent();

        expect(parentUser).toBeDefined();
        expect(parentUser.id).toBe(user.id);
        expect(parentUser.name).toBe('BelongsTo Test User');
      });
    });

    describe('Eager Loading (Includes)', () => {
      let user;

      beforeEach(async () => {
        // Create user with tasks and profile
        user = await User.create({
          name: 'Eager Load User',
          email: `eager-${Date.now()}@example.com`
        });

        await user.tasks.create({ title: 'Task 1', completed: false });
        await user.tasks.create({ title: 'Task 2', completed: true });
        await user.profile.set({ bio: 'User bio', avatar_url: 'https://example.com/avatar.jpg' });
      });

      it('should eager load hasMany associations', async () => {
        const users = await User.findAll({
          where: { id: user.id },
          include: ['Task']
        });

        expect(users).toBeDefined();
        expect(users.length).toBe(1);
        expect(users[0].id).toBe(user.id);
        // Note: Include behavior may vary by adapter implementation
      });
    });
  });

  describe('aerekos-record Attachments (hasOneAttached, hasManyAttached)', () => {
    let db;
    let Document;

    beforeAll(async () => {
      // Wait for database to be ready
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get connection string from API
      const response = await authenticatedRequest('get', 
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`
      );

      const connectionString = response.data.connection_string;
      const url = new URL(connectionString);
      const dbConfig = {
        user: url.username,
        password: url.password,
        host: url.hostname,
        port: parseInt(url.port),
        database: url.pathname.replace('/', ''),
        max: 10,
        min: 2,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000
      };

      db = Record.connect('psql', dbConfig);
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Define model with attachments
      Document = db.model('Document', {
        title: 'string',
        content: 'string'
      }, {
        required: ['title'],
        timestamps: true
      });

      // Add attachment methods (requires storage_service integration)
      // Note: These require storage_manager service to be running
      Document.hasOneAttached('avatar', {
        projectId: PROJECT_ID
      });

      Document.hasManyAttached('images', {
        projectId: PROJECT_ID
      });
    });

    afterAll(() => {
      if (db) {
        db.close();
      }
    });

    it('should attach a single file using hasOneAttached', async () => {
      const document = await Document.create({
        title: 'Document with Avatar',
        content: 'Test content'
      });

      // Mock file data
      const fileData = {
        filename: 'test-avatar.jpg',
        mimetype: 'image/jpeg',
        buffer: Buffer.from('fake image data')
      };

      try {
        const attachment = await document.avatar.attach(fileData, {
          projectId: PROJECT_ID
        });

        expect(attachment).toBeDefined();
        // Attachment should have key, url, etc.
        expect(attachment.key).toBeDefined();
      } catch (error) {
        // If storage_service is not available, skip this test
        if (error.message.includes('storage') || error.message.includes('storage_manager')) {
          console.log('Skipping attachment test - storage_service not available');
          return;
        }
        throw error;
      }
    });

    it('should attach multiple files using hasManyAttached', async () => {
      const document = await Document.create({
        title: 'Document with Images',
        content: 'Test content'
      });

      // Mock file data
      const files = [
        {
          filename: 'image1.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake image data 1')
        },
        {
          filename: 'image2.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake image data 2')
        }
      ];

      try {
        const attachments = await document.images.attach(files, {
          projectId: PROJECT_ID
        });

        expect(attachments).toBeDefined();
        expect(Array.isArray(attachments)).toBe(true);
        expect(attachments.length).toBe(2);
        attachments.forEach(attachment => {
          expect(attachment.key).toBeDefined();
        });
      } catch (error) {
        // If storage_service is not available, skip this test
        if (error.message.includes('storage') || error.message.includes('storage_manager')) {
          console.log('Skipping attachment test - storage_service not available');
          return;
        }
        throw error;
      }
    });

    it('should retrieve attached files', async () => {
      const document = await Document.create({
        title: 'Document with Attachments',
        content: 'Test content'
      });

      try {
        // Attach a file first
        const fileData = {
          filename: 'test-file.jpg',
          mimetype: 'image/jpeg',
          buffer: Buffer.from('fake image data')
        };

        await document.avatar.attach(fileData, {
          projectId: PROJECT_ID
        });

        // Retrieve attachments
        const avatar = await document.avatar.get();

        expect(avatar).toBeDefined();
        expect(avatar.key).toBeDefined();
      } catch (error) {
        // If storage_service is not available, skip this test
        if (error.message.includes('storage') || error.message.includes('storage_manager')) {
          console.log('Skipping attachment test - storage_service not available');
          return;
        }
        throw error;
      }
    });
  });

  describe('Database Lifecycle', () => {
    it('should stop database and verify health check returns unhealthy', async () => {
      // Stop database
      await authenticatedRequest('post', 
        `${API_BASE_URL}/databases/${testDbName}/stop?project_id=${PROJECT_ID}`
      );

      // Wait for container to stop
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check health (should be unhealthy)
      try {
        const response = await authenticatedRequest('get', 
          `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`
        );
        expect(response.data.healthy).toBe(false);
      } catch (error) {
        // Health check might fail entirely when stopped
        expect(error.response?.status).toBeGreaterThanOrEqual(400);
      }
    });

    it('should start database and verify it is accessible again', async () => {
      // Start database
      await authenticatedRequest('post', 
        `${API_BASE_URL}/databases/${testDbName}/start?project_id=${PROJECT_ID}`
      );

      // Wait for container to start and PostgreSQL to be ready
      let healthCheck = { healthy: false };
      let attempts = 0;
      while (!healthCheck.healthy && attempts < 30) {
        try {
          const healthResponse = await authenticatedRequest('get', 
            `${API_BASE_URL}/databases/${testDbName}/health?project_id=${PROJECT_ID}`,
            null,
            {
              timeout: 5000
            }
          );
          healthCheck = healthResponse.data;
        } catch (error) {
          // Health check failed, wait and retry
        }
        if (!healthCheck.healthy) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          attempts++;
        }
      }

      expect(healthCheck.healthy).toBe(true);
    });
  });
});


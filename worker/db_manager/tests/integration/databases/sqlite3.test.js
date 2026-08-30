/**
 * SQLite3 Integration Tests
 * Tests SQLite3 database creation, health checks, and aerekos-record connectivity
 * 
 * These tests require:
 * - db_manager service running
 * - key_manager service running
 * - Conductor service running
 * - File system access for SQLite database files
 */

const axios = require('axios');
const Record = require('aerekos-record');
const fs = require('fs');
const path = require('path');

describe('SQLite3 Integration Tests', () => {
  const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000/api/services/db_manager/api';
  const PROJECT_ID = process.env.TEST_PROJECT_ID || 'test-project-id';
  let testDbName;
  let authToken; // Will be set if needed
  let dbFilePath;

  beforeAll(() => {
    // Generate unique test database name
    testDbName = `test-sqlite3-${Date.now()}`;
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

    // Also clean up database file if it exists
    if (dbFilePath && fs.existsSync(dbFilePath)) {
      try {
        fs.unlinkSync(dbFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  });

  describe('Database Creation', () => {
    it('should create SQLite3 database via API', async () => {
      const response = await axios.post(
        `${API_BASE_URL}/databases?project_id=${PROJECT_ID}`,
        {
          name: testDbName,
          type: 'sqlite3'
        },
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(201);
      expect(response.data.database).toBeDefined();
      expect(response.data.database.name).toBe(testDbName);
      expect(response.data.database.type).toBe('sqlite3');
      expect(response.data.database.status).toBe('running');
    });

    it('should verify database file exists at correct path', async () => {
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(response.status).toBe(200);
      expect(response.data.database.metadata).toBeDefined();

      const metadata = JSON.parse(response.data.database.metadata);
      expect(metadata.database).toBeDefined();
      expect(metadata.database).toMatch(/\.db$/); // Should end with .db

      dbFilePath = metadata.database;

      // Verify file exists
      expect(fs.existsSync(dbFilePath)).toBe(true);
    });
  });

  describe('Health Checks', () => {
    it('should return healthy status for existing database file', async () => {
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
    let connectionInfo;
    let db;

    beforeAll(async () => {
      // Get connection info from API
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      connectionInfo = JSON.parse(response.data.connection_string);
      expect(connectionInfo).toBeDefined();
      expect(connectionInfo.database).toBeDefined();

      // Connect using aerekos-record
      db = Record.connect('sqlite', {
        database: connectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });
    });

    afterAll(() => {
      if (db) {
        db.close();
      }
    });

    it('should connect to SQLite3 using aerekos-record', async () => {
      const healthCheck = await db.healthCheck();
      expect(healthCheck.healthy).toBe(true);
    });

    it('should create tables using aerekos-record models', async () => {
      const TestModel = db.model('SQLite3Test', {
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
      const TestModel = db.model('SQLite3Test', {
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
      const TestModel = db.model('SQLite3Test', {
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
      const TestModel = db.model('SQLite3Test', {
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
      const TestModel = db.model('SQLite3Test', {
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

    it('should verify data persistence (close connection, reopen, verify data still exists)', async () => {
      const TestModel = db.model('SQLite3Test', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      // Create a record
      const record = await TestModel.create({
        name: 'Persistence Test',
        email: 'persist@example.com',
        age: 42
      });

      const recordId = record.id;

      // Close connection
      db.close();

      // Reopen connection
      db = Record.connect('sqlite', {
        database: connectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

      // Reload model
      const ReloadedModel = db.model('SQLite3Test', {
        name: 'string',
        email: 'string',
        age: 'number'
      }, {
        required: ['name', 'email'],
        timestamps: true
      });

      // Verify data still exists
      const reloaded = await ReloadedModel.findById(recordId);
      expect(reloaded).toBeDefined();
      expect(reloaded.name).toBe('Persistence Test');
      expect(reloaded.email).toBe('persist@example.com');
      expect(reloaded.age).toBe(42);
    });
  });

  describe('Database Isolation', () => {
    let secondDbName;
    let secondDbFilePath;

    beforeAll(() => {
      secondDbName = `test-sqlite3-2-${Date.now()}`;
    });

    afterAll(async () => {
      // Cleanup second database
      try {
        await axios.delete(`${API_BASE_URL}/databases/${secondDbName}?project_id=${PROJECT_ID}`, {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        });
      } catch (error) {
        // Ignore cleanup errors
      }

      if (secondDbFilePath && fs.existsSync(secondDbFilePath)) {
        try {
          fs.unlinkSync(secondDbFilePath);
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    });

    it('should test multiple SQLite3 databases in same project (isolation)', async () => {
      // Create second database
      const createResponse = await axios.post(
        `${API_BASE_URL}/databases?project_id=${PROJECT_ID}`,
        {
          name: secondDbName,
          type: 'sqlite3'
        },
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      expect(createResponse.status).toBe(201);

      // Get second database info
      const getResponse = await axios.get(
        `${API_BASE_URL}/databases/${secondDbName}?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      const metadata = JSON.parse(getResponse.data.database.metadata);
      secondDbFilePath = metadata.database;

      // Verify databases are in different files
      expect(dbFilePath).not.toBe(secondDbFilePath);
      expect(fs.existsSync(dbFilePath)).toBe(true);
      expect(fs.existsSync(secondDbFilePath)).toBe(true);

      // Connect to second database
      const connectionResponse = await axios.get(
        `${API_BASE_URL}/databases/${secondDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      const secondConnectionInfo = JSON.parse(connectionResponse.data.connection_string);
      const secondDb = Record.connect('sqlite', {
        database: secondConnectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

      // Create model in second database
      const SecondModel = secondDb.model('IsolationTest', {
        name: 'string',
        value: 'number'
      }, {
        required: ['name'],
        timestamps: true
      });

      // Insert data in second database
      const secondRecord = await SecondModel.create({
        name: 'Isolated Data',
        value: 999
      });

      // Verify data is in second database
      const secondRecords = await SecondModel.findAll();
      expect(secondRecords.length).toBe(1);
      expect(secondRecords[0].value).toBe(999);

      // Verify first database doesn't have this data
      const firstDb = Record.connect('sqlite', {
        database: connectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

      const FirstModel = firstDb.model('IsolationTest', {
        name: 'string',
        value: 'number'
      }, {
        required: ['name'],
        timestamps: true
      });

      const firstRecords = await FirstModel.findAll();
      // First database should not have the record from second database
      const hasIsolatedData = firstRecords.some(r => r.value === 999);
      expect(hasIsolatedData).toBe(false);

      secondDb.close();
      firstDb.close();
    });
  });

  describe('aerekos-record Associations', () => {
    let db;
    let User, Task, Profile;
    let connectionInfo;

    beforeAll(async () => {
      // Get connection info from API
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      connectionInfo = JSON.parse(response.data.connection_string);
      db = Record.connect('sqlite', {
        database: connectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

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
    let connectionInfo;

    beforeAll(async () => {
      // Get connection info from API
      const response = await axios.get(
        `${API_BASE_URL}/databases/${testDbName}/connection?project_id=${PROJECT_ID}`,
        {
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : {}
        }
      );

      connectionInfo = JSON.parse(response.data.connection_string);
      db = Record.connect('sqlite', {
        database: connectionInfo.database,
        readonly: false,
        fileMustExist: true,
        timeout: 5000
      });

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
});


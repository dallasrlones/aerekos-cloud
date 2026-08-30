const DatabaseRepository = require('../../../api/repos/DatabaseRepository');
const { DatabaseInstance } = require('../../../api/models');

const PID = '22222222-2222-2222-2222-222222222222';

describe('DatabaseRepository', () => {
  let repository;

  beforeAll(() => {
    repository = new DatabaseRepository();
  });

  beforeEach(async () => {
    try {
      const instances = await DatabaseInstance.findAll();
      for (const instance of instances) {
        await DatabaseInstance.delete(instance.id);
      }
    } catch (error) {
      // Ignore if table doesn't exist
    }
  });

  describe('create', () => {
    it('should create a database instance', async () => {
      const instance = await repository.create({
        name: 'test-db',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      expect(instance).toHaveProperty('id');
      expect(instance.name).toBe('test-db');
    });
  });

  describe('findByName', () => {
    it('should find database by name', async () => {
      await repository.create({
        name: 'find-test-db',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      const found = await repository.findByName('find-test-db', PID);
      expect(found).not.toBeNull();
      expect(found.name).toBe('find-test-db');
    });

    it('should return null if database not found', async () => {
      const found = await repository.findByName('nonexistent-db', PID);
      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all databases', async () => {
      await repository.create({
        name: 'db1',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      await repository.create({
        name: 'db2',
        type: 'mongodb',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 27017,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      const all = await repository.findAll({ project_id: PID });
      expect(all.length).toBeGreaterThanOrEqual(2);
    });

    it('should filter by type', async () => {
      await repository.create({
        name: 'postgres-db',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      const postgresDbs = await repository.findByType('postgresql');
      expect(postgresDbs.length).toBeGreaterThanOrEqual(1);
      expect(postgresDbs[0].type).toBe('postgresql');
    });
  });

  describe('update', () => {
    it('should update database instance', async () => {
      const instance = await repository.create({
        name: 'update-test-db',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'creating',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      const updated = await repository.update(instance.id, { status: 'running' });
      expect(updated.status).toBe('running');
    });
  });

  describe('delete', () => {
    it('should delete database instance', async () => {
      const instance = await repository.create({
        name: 'delete-test-db',
        type: 'postgresql',
        project_id: PID,
        worker_id: 'worker-123',
        status: 'running',
        port: 5432,
        host: 'localhost',
        connection_string: 'encrypted',
        username: 'testuser',
        password_hash: 'hashed',
        password_encrypted: 'encrypted'
      });

      await repository.delete(instance.id);

      const found = await repository.findById(instance.id);
      expect(found).toBeNull();
    });
  });
});

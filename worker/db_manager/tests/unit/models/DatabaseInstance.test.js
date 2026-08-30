const { DatabaseInstance } = require('../../../api/models');

const PID = '00000000-0000-0000-0000-00000000a101';

describe('DatabaseInstance Model', () => {
  beforeAll(async () => {
    // uses :memory: from tests/setup.js (single in-process store for this suite)
  });

  beforeEach(async () => {
    // Clear all instances before each test
    try {
      const instances = await DatabaseInstance.findAll();
      for (const instance of instances) {
        await DatabaseInstance.delete(instance.id);
      }
    } catch (error) {
      // Ignore if table doesn't exist yet
    }
  });

  it('should create a database instance', async () => {
    const instance = await DatabaseInstance.create({
      name: 'test-db',
      type: 'postgresql',
      project_id: PID,
      worker_id: 'worker-123',
      status: 'running',
      port: 5432,
      connection_string: 'encrypted-connection-string',
      username: 'testuser',
      password_hash: 'hashed-password',
      password_encrypted: 'encrypted-password',
      resource_limits: JSON.stringify({ cpu_cores: 2, ram_gb: 4 }),
      metadata: JSON.stringify({ description: 'Test database' })
    });

    expect(instance).toHaveProperty('id');
    expect(instance.name).toBe('test-db');
    expect(instance.type).toBe('postgresql');
    expect(instance.status).toBe('running');
  });

  it('should find database instance by name', async () => {
    await DatabaseInstance.create({
      name: 'test-db',
      type: 'postgresql',
      project_id: PID,
      worker_id: 'worker-123',
      status: 'running',
      port: 5432,
      connection_string: 'encrypted',
      username: 'testuser',
      password_hash: 'hashed',
      password_encrypted: 'encrypted'
    });

    const found = await DatabaseInstance.findAll({ where: { name: 'test-db', project_id: PID } });
    expect(found).toHaveLength(1);
    expect(found[0].name).toBe('test-db');
  });

  it('should allow the same database name in two different projects', async () => {
    const other = '00000000-0000-0000-0000-00000000b202';
    await DatabaseInstance.create({
      name: 'shared-name',
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

    const second = await DatabaseInstance.create({
      name: 'shared-name',
      type: 'postgresql',
      project_id: other,
      worker_id: 'worker-123',
      status: 'running',
      port: 5432,
      host: 'localhost',
      connection_string: 'encrypted',
      username: 'testuser',
      password_hash: 'hashed',
      password_encrypted: 'encrypted'
    });

    expect(second.name).toBe('shared-name');
    expect(second.project_id).toBe(other);
  });

  it('should update database instance status', async () => {
    const instance = await DatabaseInstance.create({
      name: 'test-db-2',
      type: 'postgresql',
      project_id: PID,
      worker_id: 'worker-123',
      status: 'creating',
      port: 5432,
      connection_string: 'encrypted',
      username: 'testuser',
      password_hash: 'hashed',
      password_encrypted: 'encrypted'
    });

    await DatabaseInstance.update(instance.id, { status: 'running' });

    const updated = await DatabaseInstance.findAll({ where: { id: instance.id } });
    expect(updated[0].status).toBe('running');
  });
});

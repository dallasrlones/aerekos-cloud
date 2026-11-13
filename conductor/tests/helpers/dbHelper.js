/**
 * Database helper utilities for tests
 */
const { User, Worker, Service, Project, ProjectWorker, ProjectService, Token, Resource, ServiceDeployment, ProjectMember, ProjectInvite, ProjectStack, ProjectEnvironment, PlatformJob } = require('../../api/models');
const { initializeDatabase } = require('../../api/utils/dbInit');

/**
 * Initialize test database
 */
async function setupTestDatabase() {
  await initializeDatabase();
}

/**
 * Clean up all test data from database
 */
async function cleanupTestData() {
  try {
    // Get all records
    const users = await User.findAll();
    const workers = await Worker.findAll();
    const services = await Service.findAll();
    const projects = await Project.findAll();
    const projectWorkers = await ProjectWorker.findAll();
    const projectServices = await ProjectService.findAll();
    const tokens = await Token.findAll();
    const resources = await Resource.findAll();
    const deployments = await ServiceDeployment.findAll();

    // Delete in reverse dependency order
    for (const deployment of deployments) {
      try {
        await ServiceDeployment.delete(deployment.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const projectWorker of projectWorkers) {
      try {
        await ProjectWorker.delete(projectWorker.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const projectService of projectServices) {
      try {
        await ProjectService.delete(projectService.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const member of await ProjectMember.findAll()) {
      try {
        await ProjectMember.delete(member.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const invite of await ProjectInvite.findAll()) {
      try {
        await ProjectInvite.delete(invite.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const stackRow of await ProjectStack.findAll()) {
      try {
        await ProjectStack.delete(stackRow.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const env of await ProjectEnvironment.findAll()) {
      try {
        await ProjectEnvironment.delete(env.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const job of await PlatformJob.findAll()) {
      try {
        await PlatformJob.delete(job.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const resource of resources) {
      try {
        await Resource.delete(resource.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const token of tokens) {
      try {
        await Token.delete(token.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const service of services) {
      try {
        await Service.delete(service.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const project of projects) {
      try {
        await Project.delete(project.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const worker of workers) {
      try {
        await Worker.delete(worker.id);
      } catch (e) {
        // Ignore errors
      }
    }

    for (const user of users) {
      try {
        await User.delete(user.id);
      } catch (e) {
        // Ignore errors
      }
    }
  } catch (error) {
    console.warn('Warning: Error during test data cleanup:', error.message);
  }
}

/**
 * Create a test user
 */
async function createTestUser(overrides = {}) {
  const { hashPassword } = require('../../api/utils/password');
  const timestamp = Date.now();
  
  // If password_hash is provided, use it; otherwise generate one
  const password_hash = overrides.password_hash || await hashPassword('testpass123');
  
  return await User.create({
    username: overrides.username || `testuser-${timestamp}`,
    email: overrides.email || `testuser-${timestamp}@example.com`,
    password_hash: password_hash,
    role: overrides.role || 'user',
    ...overrides
  });
}

/**
 * Create a test worker
 */
async function createTestWorker(overrides = {}) {
  const timestamp = Date.now();
  const { resources, ...rest } = overrides;
  return await Worker.create({
    hostname: rest.hostname || `worker-${timestamp}`,
    ip_address: rest.ip_address || '192.168.1.100',
    status: rest.status || 'online',
    last_seen: rest.last_seen || new Date().toISOString(),
    // resources is a JSON-string column: accept either an object or a string
    resources: typeof resources === 'string' ? resources : JSON.stringify(resources || { cpu: 4, ram: 8, disk: 100 }),
    ...rest,
  });
}

/**
 * Create a test service
 */
async function createTestService(overrides = {}) {
  const timestamp = Date.now();
  
  return await Service.create({
    name: overrides.name || `test-service-${timestamp}`,
    enabled: overrides.enabled !== undefined ? overrides.enabled : 1,
    docker_image: overrides.docker_image || 'test/image:latest',
    config: overrides.config || JSON.stringify({ port: 8080 }),
    ...overrides
  });
}

/**
 * Create a test token
 */
async function createTestToken(overrides = {}) {
  const { randomUUID } = require('crypto');
  
  return await Token.create({
    token: overrides.token || randomUUID(),
    expires_at: overrides.expires_at || null,
    active: overrides.active !== undefined ? overrides.active : 1,
    ...overrides
  });
}

/**
 * Create a test project
 */
async function createTestProject(overrides = {}) {
  const timestamp = Date.now();
  
  return await Project.create({
    name: overrides.name || `test-project-${timestamp}`,
    description: overrides.description || `Test project ${timestamp}`,
    enabled: overrides.enabled !== undefined ? overrides.enabled : 1,
    config: overrides.config || JSON.stringify({}),
    ...overrides
  });
}

/**
 * Create a service deployment row (service running on a worker, optionally
 * scoped to a project).
 */
async function createTestDeployment(overrides = {}) {
  return await ServiceDeployment.create({
    service_id: overrides.service_id,
    worker_id: overrides.worker_id,
    project_id: overrides.project_id !== undefined ? overrides.project_id : null,
    status: overrides.status || 'deployed',
    deployed_at: overrides.deployed_at || new Date().toISOString(),
    ...overrides
  });
}

/**
 * Seed a complete project fixture in ONE call — the standard "arrange" for
 * integration tests. Project + workers + services + project-service links +
 * deployment rows. Teardown is cleanupTestData() (delete everything, in
 * dependency order).
 *
 *   const fx = await seedProjectFixture({
 *     project:  { name: 'my-proj' },
 *     workers:  [{ hostname: 'w1' }, { hostname: 'w2', status: 'offline',
 *                  resources: { disk: { available_gb: 500 } } }],
 *     services: [{ name: 'storage_manager' }, { name: 'git_manager' }],
 *     enable:   ['storage_manager'],           // link to the project
 *     deploy:   { storage_manager: 'w1' },     // pin by worker HOSTNAME
 *   });
 *   // fx = { project, workers: {w1, w2}, services: {storage_manager, git_manager}, deployments: [...] }
 */
async function seedProjectFixture({
  project: projectOverrides = {},
  workers: workerSpecs = [],
  services: serviceSpecs = [],
  enable = [],
  deploy = {},
} = {}) {
  const project = await createTestProject(projectOverrides);

  const workers = {};
  for (const spec of workerSpecs) {
    const w = await createTestWorker(spec);
    workers[spec.hostname || w.hostname] = w;
  }

  const services = {};
  for (const spec of serviceSpecs) {
    const s = await createTestService(spec);
    services[spec.name || s.name] = s;
  }

  for (const name of enable) {
    const svc = services[name];
    if (!svc) throw new Error(`seedProjectFixture: enable "${name}" but no such service seeded`);
    const existing = await ProjectService.findAll({ where: { project_id: project.id, service_id: svc.id } });
    if (!existing.length) {
      await ProjectService.create({ project_id: project.id, service_id: svc.id, enabled: 1 });
    }
  }

  const deployments = [];
  for (const [name, workerHost] of Object.entries(deploy)) {
    const svc = services[name];
    const worker = workers[workerHost];
    if (!svc || !worker) throw new Error(`seedProjectFixture: deploy "${name}" -> "${workerHost}" references unknown fixture`);
    deployments.push(await createTestDeployment({
      service_id: svc.id,
      worker_id: worker.id,
      project_id: project.id,
    }));
  }

  return { project, workers, services, deployments };
}

module.exports = {
  setupTestDatabase,
  cleanupTestData,
  createTestUser,
  createTestWorker,
  createTestService,
  createTestToken,
  createTestProject,
  createTestDeployment,
  seedProjectFixture
};

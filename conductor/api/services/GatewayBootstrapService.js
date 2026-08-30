'use strict';

const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

/**
 * Seed standard api_manager gateway routes when a project is created.
 */
async function seedGatewayRoutesForProject(projectId) {
  if (!projectId) return { skipped: true, reason: 'no project_id' };

  const sm = ServiceManager.getInstance(WorkerRepository);
  try {
    const result = await sm.proxyServiceRequest(
      'api_manager',
      'POST',
      '/api/v1/endpoints/seed-presets',
      { project_id: projectId },
      {},
      projectId,
    );
    return { ok: true, data: result.data };
  } catch (err) {
    console.warn(`[GatewayBootstrap] seed presets failed for ${projectId}:`, err.message || err);
    return { ok: false, error: err.message || String(err) };
  }
}

module.exports = { seedGatewayRoutesForProject };

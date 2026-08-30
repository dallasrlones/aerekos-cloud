'use strict';

const { Service, Project, ProjectService } = require('../models');
const { PLATFORM_DEVICE_SERVICES } = require('../config/platformDeviceServices');

/**
 * Mark observe/CI/git/registry as catalog-enabled and attach them to every project.
 * Does not deploy containers — those are device-level (compose / one process per host).
 */
async function ensurePlatformDeviceServices() {
  const projects = await Project.findAll({ where: {} });
  for (const name of PLATFORM_DEVICE_SERVICES) {
    const rows = await Service.findAll({ where: { name } });
    if (!rows.length) continue;
    const service = rows[0];
    if (service.enabled !== 1) {
      await Service.update(service.id, { enabled: 1 });
    }
    for (const project of projects) {
      const existing = await ProjectService.findAll({
        where: { project_id: project.id, service_id: service.id },
      });
      if (!existing.length) {
        await ProjectService.create({
          project_id: project.id,
          service_id: service.id,
          enabled: 1,
          config: '{}',
          scaling_policy: '{}',
        });
      } else if (existing[0].enabled !== 1) {
        await ProjectService.update(existing[0].id, { enabled: 1 });
      }
    }
  }
}

async function attachPlatformServicesToProject(projectId) {
  if (!projectId) return;
  for (const name of PLATFORM_DEVICE_SERVICES) {
    const rows = await Service.findAll({ where: { name } });
    if (!rows.length) continue;
    const existing = await ProjectService.findAll({
      where: { project_id: projectId, service_id: rows[0].id },
    });
    if (!existing.length) {
      await ProjectService.create({
        project_id: projectId,
        service_id: rows[0].id,
        enabled: 1,
        config: '{}',
        scaling_policy: '{}',
      });
    } else if (existing[0].enabled !== 1) {
      await ProjectService.update(existing[0].id, { enabled: 1 });
    }
  }
}

module.exports = { ensurePlatformDeviceServices, attachPlatformServicesToProject };

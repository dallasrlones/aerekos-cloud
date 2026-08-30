'use strict';

const { ProjectEnvironment, Project } = require('../models');
const { isSystemProject } = require('../config/systemProject');

function serialize(row) {
  return {
    id: row.id,
    project_id: row.project_id,
    name: row.name,
    git_ref: row.git_ref || (row.name === 'prod' ? 'main' : 'develop'),
    protected: Number(row.protected) === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

class EnvironmentService {
  async list(projectId) {
    if (!projectId) {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
    const rows = await ProjectEnvironment.findAll({ where: { project_id: projectId } });
    return rows.map(serialize);
  }

  async ensureForProject(projectId, projectName = '') {
    const existing = await this.list(projectId);
    if (!existing.some((e) => e.name === 'prod')) {
      await ProjectEnvironment.create({
        project_id: projectId,
        name: 'prod',
        git_ref: 'main',
        protected: 1,
      });
    }
    const system = isSystemProject(projectId) || String(projectName).toLowerCase() === 'system';
    if (!system && !existing.some((e) => e.name === 'dev')) {
      await ProjectEnvironment.create({
        project_id: projectId,
        name: 'dev',
        git_ref: 'develop',
        protected: 0,
      });
    }
    return this.list(projectId);
  }

  async ensureAll() {
    const projects = await Project.findAll();
    for (const p of projects || []) {
      await this.ensureForProject(p.id, p.name);
    }
  }

  async create(projectId, body = {}) {
    const name = String(body.name || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{0,31}$/.test(name)) {
      const e = new Error('name: start with a letter, then letters/numbers/hyphens');
      e.status = 400;
      throw e;
    }
    if (isSystemProject(projectId) && name !== 'prod') {
      const e = new Error('system project is prod-only');
      e.status = 400;
      throw e;
    }
    const dup = await ProjectEnvironment.findAll({ where: { project_id: projectId, name } });
    if (dup.length) {
      const e = new Error(`environment ${name} already exists`);
      e.status = 409;
      throw e;
    }
    const row = await ProjectEnvironment.create({
      project_id: projectId,
      name,
      git_ref: String(body.git_ref || (name === 'prod' ? 'main' : name)).trim() || name,
      protected: name === 'prod' ? 1 : 0,
    });
    return serialize(row);
  }

  async resolveByGitRef(projectId, ref) {
    const branch = String(ref || '').replace(/^refs\/heads\//, '');
    const list = await this.list(projectId);
    return list.find((e) => e.git_ref === branch) || null;
  }
}

module.exports = new EnvironmentService();

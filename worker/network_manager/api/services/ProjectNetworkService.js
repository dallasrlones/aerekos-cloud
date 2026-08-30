const crypto = require('crypto');
const { ProjectNetwork } = require('../models');
const { DockerNetworkClient } = require('./DockerNetworkClient');

const NAME_RE = /^[a-zA-Z][a-zA-Z0-9_-]{0,62}$/;
const DRIVERS = new Set(['bridge', 'host', 'overlay']);

class ProjectNetworkService {
  constructor(deps = {}) {
    this.ProjectNetwork = deps.ProjectNetwork || ProjectNetwork;
    this.client = deps.client || new DockerNetworkClient();
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  validateLogicalName(name) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error(
        'name: 1-63 chars, start with a letter; letters, numbers, hyphen, underscore only'
      );
      e.status = 400;
      throw e;
    }
    return String(name).trim();
  }

  assertDriver(driver) {
    const d = (driver == null ? 'bridge' : String(driver)).toLowerCase();
    if (!DRIVERS.has(d)) {
      const e = new Error('driver must be bridge, host, or overlay (MVP: use bridge)');
      e.status = 400;
      throw e;
    }
    if (d !== 'bridge') {
      const e = new Error('Only bridge driver is implemented in this MVP');
      e.status = 501;
      throw e;
    }
    return d;
  }

  /** Deterministic Docker network name for a project + logical name (host-unique). */
  computeDockerName(projectId, logicalName) {
    const h = crypto
      .createHash('sha256')
      .update(`${projectId}\0${logicalName}`)
      .digest('hex')
      .slice(0, 20);
    return `aerekosn_${h}`;
  }

  isSkip() {
    return process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true';
  }

  async create(body) {
    this.assertProjectId(body.project_id);
    const name = this.validateLogicalName(body.name);
    this.assertDriver(body.driver);
    const existing = await this.ProjectNetwork.findAll({
      where: { project_id: body.project_id, name }
    });
    if (existing.length) {
      const e = new Error(`A network named "${name}" already exists in this project`);
      e.status = 409;
      e.code = 'NAME_TAKEN';
      throw e;
    }
    const dockerName = this.computeDockerName(body.project_id, name);
    if (this.isSkip()) {
      return this.ProjectNetwork.create({
        project_id: body.project_id,
        name,
        docker_network_name: `mock-${dockerName}`,
        docker_network_id: `mock-${crypto.randomBytes(8).toString('hex')}`,
        driver: 'bridge',
        last_error: ''
      });
    }
    let created;
    try {
      created = await this.client.createBridgeNetwork({
        name: dockerName,
        labels: {
          'aerekos.project_id': String(body.project_id),
          'aerekos.network.logical': name
        }
      });
    } catch (e) {
      const err = new Error(e.message || 'Failed to create Docker network');
      err.status = e.statusCode === 409 ? 409 : 502;
      throw err;
    }
    return this.ProjectNetwork.create({
      project_id: body.project_id,
      name,
      docker_network_name: created.name.replace(/^\//, '') || dockerName,
      docker_network_id: created.id,
      driver: 'bridge',
      last_error: ''
    });
  }

  async list(projectId) {
    this.assertProjectId(projectId);
    return this.ProjectNetwork.findAll({ where: { project_id: projectId } });
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.ProjectNetwork.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Network not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async deleteById(id, projectId) {
    const row = await this.getById(id, projectId);
    if (!this.isSkip()) {
      const toRemove = row.docker_network_name.replace(/^\//, '');
      await this.client.removeNetworkByName(toRemove);
    }
    await this.ProjectNetwork.delete(id);
    return { deleted: true, id };
  }

  async ensureDefault(projectId) {
    this.assertProjectId(projectId);
    const existing = await this.ProjectNetwork.findAll({ where: { project_id: projectId, name: 'default' } });
    if (existing.length) return existing[0];
    return this.create({ project_id: projectId, name: 'default', driver: 'bridge' });
  }
}

module.exports = { ProjectNetworkService };

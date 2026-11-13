'use strict';

/**
 * Pluggable node agent for aerekos Compute.
 * v0.1.0: Docker via TaskService / dockerode. Future: containerd, firecracker, etc.
 */
class NodeAgent {
  /**
   * @param {{ runtime?: string, taskService?: object }} [opts]
   */
  constructor(opts = {}) {
    this.runtime = opts.runtime || process.env.AEREKOS_COMPUTE_RUNTIME || 'docker';
    this.taskService = opts.taskService || null;
  }

  async applyPod(projectId, deploymentId, podSpec, opts = {}) {
    if (this.runtime !== 'docker') {
      const e = new Error(`runtime ${this.runtime} not implemented in v0.1.0`);
      e.status = 501;
      throw e;
    }
    if (process.env.SKIP_DOCKER === '1' && process.env.COMPUTE_E2E_DOCKER !== '1') {
      return { skipped: true, runtime: 'docker', reason: 'SKIP_DOCKER' };
    }
    if (!this.taskService) {
      const e = new Error('taskService required for docker node agent');
      e.status = 500;
      throw e;
    }
    const image = podSpec?.containers?.[0]?.image;
    if (!image) {
      const e = new Error('podSpec.containers[0].image required');
      e.status = 400;
      throw e;
    }
    return {
      runtime: 'docker',
      result: await this.taskService.replaceImage(deploymentId, projectId, image, opts),
    };
  }

  async scale(projectId, deploymentId, replicas, opts = {}) {
    if (process.env.SKIP_DOCKER === '1' && process.env.COMPUTE_E2E_DOCKER !== '1') {
      return { skipped: true, replicas };
    }
    return {
      runtime: this.runtime,
      result: await this.taskService.scaleTask(deploymentId, projectId, replicas, opts),
    };
  }
}

module.exports = { NodeAgent };

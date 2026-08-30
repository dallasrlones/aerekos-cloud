'use strict';

const WorkerService = require('./WorkerService');
const WorkerSocketService = require('./WorkerSocketService');
const AuditService = require('./AuditService');

const CHECK_TIMEOUT_MS = 90 * 1000;
const UPDATE_TIMEOUT_MS = 15 * 60 * 1000;

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

class HostService {
  async assertOnline(workerId) {
    const worker = await WorkerService.getWorker(workerId);
    if (!WorkerSocketService.isWorkerConnected(workerId)) {
      throw httpError(503, 'Worker is offline');
    }
    return worker;
  }

  async persistHost(workerId, host) {
    if (!host) return;
    try {
      const worker = await WorkerService.getWorker(workerId);
      const prev = worker.resources && typeof worker.resources === 'object' ? worker.resources : {};
      const resources = { ...prev, host };
      await WorkerService.updateResources(workerId, resources);
      WorkerSocketService.broadcastToFrontend('worker:resources:updated', {
        workerId,
        resources,
      });
    } catch (err) {
      console.warn(`[Host] failed to persist host status for ${workerId}:`, err.message);
    }
  }

  hostFromReply(reply) {
    if (!reply) return null;
    if (reply.os || reply.docker) {
      return {
        os: reply.os,
        docker: reply.docker,
        platform: reply.platform,
        probed_at: reply.probed_at,
        error: reply.error,
      };
    }
    if (reply.after && (reply.after.os || reply.after.docker)) {
      return reply.after;
    }
    return null;
  }

  async check(workerId) {
    await this.assertOnline(workerId);
    const reply = await WorkerSocketService.requestFromWorker(
      workerId,
      'host:check',
      {},
      'host:check:result',
      CHECK_TIMEOUT_MS
    );
    const host = this.hostFromReply(reply);
    await this.persistHost(workerId, host);
    return {
      worker_id: workerId,
      ...reply,
    };
  }

  async update(workerId, target, { actorId, ip, requestId } = {}) {
    if (target !== 'os' && target !== 'docker') {
      throw httpError(400, "target must be 'os' or 'docker'");
    }
    await this.assertOnline(workerId);

    console.log(`[Host] update requested worker=${workerId} target=${target} actor=${actorId || 'unknown'}`);
    try {
      await AuditService.log({
        action: 'host.update',
        actor_type: actorId ? 'user' : 'system',
        actor_id: actorId || '',
        resource_type: 'worker',
        resource_id: workerId,
        ip_address: ip || '',
        request_id: requestId || '',
        outcome: 'requested',
        detail: { target },
      });
    } catch (err) {
      console.warn('[Host] audit log failed:', err.message);
    }

    const reply = await WorkerSocketService.requestFromWorker(
      workerId,
      'host:update',
      { target },
      'host:update:result',
      UPDATE_TIMEOUT_MS
    );

    const outcome = reply?.ok === false ? 'failure' : 'success';
    console.log(`[Host] update ${outcome} worker=${workerId} target=${target}`);
    try {
      await AuditService.log({
        action: 'host.update',
        actor_type: actorId ? 'user' : 'system',
        actor_id: actorId || '',
        resource_type: 'worker',
        resource_id: workerId,
        ip_address: ip || '',
        request_id: reply?.requestId || requestId || '',
        outcome,
        detail: {
          target,
          reboot_required: reply?.reboot_required || false,
          error: reply?.error,
        },
      });
    } catch (err) {
      console.warn('[Host] audit log failed:', err.message);
    }

    const host = this.hostFromReply(reply);
    await this.persistHost(workerId, host);
    return {
      worker_id: workerId,
      target,
      ...reply,
    };
  }
}

module.exports = new HostService();

'use strict';

const { IntelligenceJob } = require('../models');
const { IntelligenceJobService } = require('./IntelligenceJobService');
const { IntelligenceService } = require('./IntelligenceService');
const { proxy } = require('../../../shared/conductorProxy');

function skip() {
  return process.env.SKIP_JOB_CONSUMER === '1' || process.env.SKIP_JOB_CONSUMER === 'true'
    || process.env.SKIP_BROKER === '1' || process.env.SKIP_BROKER === 'true';
}

class IntelligenceJobConsumer {
  constructor(deps = {}) {
    this.jobs = deps.jobs || new IntelligenceJobService();
    this.intel = deps.intel || new IntelligenceService();
    this._stopping = false;
  }

  async consumeOnce(ch, queueName, msg) {
    let body = {};
    try { body = JSON.parse(msg.content.toString('utf8')); } catch { body = {}; }
    const jobId = body.job_id || body.id;
    if (!jobId) {
      ch.ack(msg);
      return;
    }
    const result = await this.jobs.runJob(jobId);
    if (result.skipped && (result.reason === 'succeeded' || result.reason === 'cancelled' || result.reason === 'missing')) {
      ch.ack(msg);
      return;
    }
    ch.ack(msg);
  }

  async startAmqp() {
    const amqplib = require('amqplib');
    const url = process.env.RABBITMQ_URL || 'amqp://aerekos:aerekos@rabbitmq:5672';
    const conn = await amqplib.connect(url, { heartbeat: 30 });
    const ch = await conn.createChannel();
    await ch.prefetch(1);
    const endpoints = await this.intel.M.findAll({ where: { execution: 'queued' } }).catch(() => []);
    const names = new Set((endpoints || []).map((e) => e.queue_name || `${e.name}-inbox`).filter(Boolean));
    if (!names.size) names.add('intelligence-inbox');
    for (const qn of names) {
      const physical = endpoints.find((e) => (e.queue_name || `${e.name}-inbox`) === qn);
      const projectId = physical?.project_id;
      const amqpName = projectId ? `aerekos.${projectId}.${qn}` : qn;
      await ch.assertQueue(amqpName, { durable: true }).catch(() => {});
      await ch.consume(amqpName, async (msg) => {
        if (!msg) return;
        try {
          await this.consumeOnce(ch, qn, msg);
        } catch (e) {
          console.error('[ai_manager] job consume', e.message);
          ch.nack(msg, false, true);
        }
      }, { noAck: false });
    }
    return { conn, ch };
  }

  async reconcileQueued() {
    const rows = await IntelligenceJob.findAll({ where: { status: 'queued' } }).catch(() => []);
    let n = 0;
    for (const row of rows) {
      try {
        const ep = await this.intel.getByName(row.project_id, row.intelligence);
        const inbox = ep.queue_name || `${ep.name}-inbox`;
        await proxy('POST', `/api/services/queue_manager/api/v1/queues/${encodeURIComponent(inbox)}/messages`, {
          projectId: row.project_id,
          timeout: 8000,
          data: { project_id: row.project_id, body: { job_id: row.id } },
        });
        n += 1;
      } catch (_) { /* queue down */ }
    }
    return { republished: n };
  }

  async purgeOld(days = 90) {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const rows = await IntelligenceJob.findAll({}).catch(() => []);
    let n = 0;
    for (const r of rows) {
      if (!['succeeded', 'failed', 'cancelled'].includes(r.status)) continue;
      const t = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (t && t < cutoff) {
        await IntelligenceJob.delete(r.id);
        n += 1;
      }
    }
    return { purged: n };
  }

  startPoll() {
    if (this._poll) return;
    this._poll = setInterval(async () => {
      if (this._busy) return;
      const rows = await IntelligenceJob.findAll({ where: { status: 'queued' } }).catch(() => []);
      const row = (rows || [])[0];
      if (!row) return;
      this._busy = true;
      try {
        await this.jobs.runJob(row.id);
      } catch (e) {
        console.warn('[ai_manager] job poll', e.message);
      } finally {
        this._busy = false;
      }
    }, 2500);
    if (this._poll.unref) this._poll.unref();
  }

  async start() {
    if (skip()) return { skipped: true };
    try {
      await this.jobs.reclaimStale();
      await this.purgeOld(90);
      await this.reconcileQueued();
    } catch (e) {
      console.warn('[ai_manager] job reconcile', e.message);
    }
    this.startPoll();
    try {
      return await this.startAmqp();
    } catch (e) {
      console.warn('[ai_manager] job AMQP consumer', e.message);
      return { error: e.message };
    }
  }
}

module.exports = { IntelligenceJobConsumer };

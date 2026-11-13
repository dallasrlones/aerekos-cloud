const { Queue, Message } = require('../models');
const brokers = require('./brokers');
const { createQueueProvider, usesQueueProvider } = require('../../../shared/queueProvider');

const MAX_BODY_BYTES = 256 * 1024;
const DEFAULT_VISIBILITY = 30;
const MAX_VISIBILITY = 12 * 60 * 60; // 12h, SQS max

const NAME_RE = /^[a-zA-Z0-9_-]{1,80}$/;

function nowIso() {
  return new Date().toISOString();
}

function isAvailable(m, at) {
  if (!m.locked_until) return true;
  return new Date(m.locked_until) <= at;
}

class QueueService {
  /**
   * @param {{ Queue: typeof import('../models').Queue, Message: typeof import('../models').Message }} [models]
   */
  constructor(models = { Queue, Message }) {
    this.Queue = models.Queue;
    this.Message = models.Message;
    this._queueProvider = usesQueueProvider() ? createQueueProvider() : null;
  }

  useProvider(q) {
    return (
      Boolean(this._queueProvider) &&
      (q.engine === 'standard' || q.engine === 'fifo')
    );
  }

  assertQueueName(name) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error('Invalid queue name. Use 1–80 chars: letters, numbers, _, -');
      e.status = 400;
      throw e;
    }
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  assertBody(body) {
    if (body === undefined || body === null) {
      const e = new Error('body is required');
      e.status = 400;
      throw e;
    }
    const s = typeof body === 'string' ? body : JSON.stringify(body);
    if (Buffer.byteLength(s, 'utf8') > MAX_BODY_BYTES) {
      const e = new Error(`message body must be at most ${MAX_BODY_BYTES} bytes`);
      e.status = 400;
      throw e;
    }
  }

  parseVisibility(vis) {
    if (vis === undefined || vis === null) return DEFAULT_VISIBILITY;
    const n = Number(vis);
    if (!Number.isFinite(n) || n < 0 || n > MAX_VISIBILITY) {
      const e = new Error(`visibility_timeout_seconds must be 0..${MAX_VISIBILITY}`);
      e.status = 400;
      throw e;
    }
    return Math.floor(n);
  }

  async createQueue({ name, projectId, visibilityTimeoutSeconds, engine, dlq, maxReceive }) {
    this.assertQueueName(name);
    this.assertProjectId(projectId);
    const v = this.parseVisibility(visibilityTimeoutSeconds);
    const eng = String(engine || 'standard').toLowerCase();
    if (!['standard', 'fifo', 'rabbitmq', 'redis_stream'].includes(eng)) {
      const e = new Error('engine must be standard|fifo|rabbitmq|redis_stream');
      e.status = 400;
      throw e;
    }
    const existing = await this.Queue.findAll({
      where: { name, project_id: projectId }
    });
    if (existing.length) {
      const e = new Error(`Queue already exists: ${name}`);
      e.status = 409;
      throw e;
    }

    const row = await this.Queue.create({
      name: String(name).trim(),
      project_id: projectId,
      visibility_timeout_seconds: v,
      engine: eng,
      dlq: dlq || '',
      max_receive: maxReceive || 3,
    });
    if (!brokers.skipBroker() && eng === 'rabbitmq') {
      await brokers.rabbitDeclare(projectId, row.name, row.dlq || '');
    }
    if (!brokers.skipBroker() && eng === 'redis_stream') {
      await brokers.redisEnsureGroup(projectId, row.name);
      if (row.dlq) await brokers.redisEnsureGroup(projectId, row.dlq);
    }
    return row;
  }

  useBroker(q) {
    return !brokers.skipBroker() && (q.engine === 'rabbitmq' || q.engine === 'redis_stream');
  }

  async depthFor(q) {
    if (this.useProvider(q)) {
      return this._queueProvider.depth(q.project_id, q.name);
    }
    if (!this.useBroker(q)) {
      const msgs = await this.Message.findAll({ where: { queue_id: q.id } });
      return msgs.length;
    }
    if (q.engine === 'rabbitmq') return brokers.rabbitDepth(q.project_id, q.name);
    return brokers.redisDepth(q.project_id, q.name);
  }

  serialize(q, depth) {
    return {
      id: q.id,
      name: q.name,
      project_id: q.project_id,
      visibility_timeout_seconds: q.visibility_timeout_seconds,
      engine: q.engine || 'standard',
      dlq: q.dlq || '',
      max_receive: q.max_receive || 3,
      depth: depth == null ? undefined : depth,
      created_at: q.created_at,
    };
  }

  async listQueues(projectId) {
    this.assertProjectId(projectId);
    return this.Queue.findAll({ where: { project_id: projectId } });
  }

  async getQueueByName(name, projectId) {
    this.assertQueueName(name);
    this.assertProjectId(projectId);
    const rows = await this.Queue.findAll({
      where: { name, project_id: projectId }
    });
    if (!rows.length) {
      const e = new Error('Queue not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async deleteQueue(name, projectId) {
    const q = await this.getQueueByName(name, projectId);
    if (this.useBroker(q)) {
      if (q.engine === 'rabbitmq') await brokers.rabbitDeleteQueue(projectId, name);
      else await brokers.redisDeleteQueue(projectId, name);
    }
    const msgs = await this.Message.findAll({ where: { queue_id: q.id } });
    for (const m of msgs) {
      await this.Message.delete(m.id);
    }
    await this.Queue.delete(q.id);
    return { deleted: true, queueName: name };
  }

  async sendMessage(queueName, projectId, body, extras = {}) {
    this.assertProjectId(projectId);
    this.assertBody(body);
    const q = await this.getQueueByName(queueName, projectId);
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    if (this.useProvider(q)) {
      return this._queueProvider.publish(q.project_id, queueName, text, extras);
    }
    if (this.useBroker(q)) {
      const id = q.engine === 'rabbitmq'
        ? await brokers.rabbitPublish(projectId, queueName, text, extras)
        : await brokers.redisPublish(projectId, queueName, text, extras);
      return { MessageId: id, MD5: null };
    }
    if (q.engine === 'fifo' && extras.dedup_id) {
      const prior = await this.Message.findAll({ where: { queue_id: q.id, dedup_id: extras.dedup_id } });
      if (prior.length) return { MessageId: prior[0].id, MD5: null, dedup: true };
    }
    const msg = await this.Message.create({
      body: text,
      project_id: projectId,
      queue_id: q.id,
      locked_until: null,
      receive_count: 0,
      group_id: extras.group_id || '',
      dedup_id: extras.dedup_id || '',
    });
    return { MessageId: msg.id, MD5: null };
  }

  /**
   * Receive up to `max` visible messages; lock each until `visibilityTimeout` (seconds).
   * Uses in-memory sort/filter — OK for typical queue depths; can move to SQL later.
   */
  async receiveMessages(queueName, projectId, maxNumber, visibilityOverride) {
    this.assertProjectId(projectId);
    const max = Math.min(Math.max(1, Number(maxNumber) || 1), 10);
    const q = await this.getQueueByName(queueName, projectId);
    const vis = visibilityOverride != null
      ? this.parseVisibility(visibilityOverride)
      : this.parseVisibility(q.visibility_timeout_seconds);

    if (this.useProvider(q)) {
      return this._queueProvider.receive(q.project_id, queueName, max, {
        visibilitySeconds: vis,
        maxReceive: q.max_receive || 3,
        dlqName: q.dlq || '',
        fifo: q.engine === 'fifo',
      });
    }
    if (this.useBroker(q)) {
      const maxReceive = q.max_receive || 3;
      const raw = q.engine === 'rabbitmq'
        ? await brokers.rabbitGet(projectId, queueName, max)
        : await brokers.redisRead(projectId, queueName, max, {
          dlqName: q.dlq || '',
          maxReceive,
          visibilityMs: vis * 1000,
        });
      const kept = [];
      for (const m of raw) {
        if (q.engine === 'rabbitmq' && q.dlq && (m.receive_count || 0) > maxReceive) {
          await brokers.rabbitNack(m.ReceiptHandle, false);
          continue;
        }
        kept.push(m);
      }
      return { Messages: kept, QueueName: queueName };
    }

    const at = new Date();
    const all = await this.Message.findAll({ where: { queue_id: q.id, project_id: projectId } });
    const visible = all
      .filter((m) => isAvailable(m, at))
      .sort((a, b) => {
        const ga = String(a.group_id || '');
        const gb = String(b.group_id || '');
        if (q.engine === 'fifo' && ga !== gb) return ga.localeCompare(gb);
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        return ta - tb;
      })
      .slice(0, max);

    const until = new Date(at.getTime() + vis * 1000);
    const untilStr = vis === 0 ? null : until.toISOString();

    const out = [];
    for (const m of visible) {
      const nextCount = (m.receive_count || 0) + 1;
      const max = q.max_receive || 3;
      if (q.dlq && nextCount > max) {
        await this.sendMessage(q.dlq, projectId, m.body);
        await this.Message.delete(m.id);
        continue;
      }
      await this.Message.update(m.id, {
        locked_until: vis === 0 ? null : untilStr,
        receive_count: nextCount
      });
      out.push({
        MessageId: m.id,
        Body: m.body,
        ReceiptHandle: m.id,
        receive_count: nextCount,
        group_id: m.group_id || undefined,
      });
    }
    return { Messages: out, QueueName: queueName };
  }

  async deleteMessage(queueName, projectId, messageId) {
    this.assertProjectId(projectId);
    if (!messageId) {
      const e = new Error('message_id is required');
      e.status = 400;
      throw e;
    }
    const q = await this.getQueueByName(queueName, projectId);
    if (this.useProvider(q)) {
      return this._queueProvider.ack(q.project_id, queueName, messageId);
    }
    if (this.useBroker(q)) {
      if (q.engine === 'rabbitmq') await brokers.rabbitAck(messageId);
      else await brokers.redisAck(messageId);
      return { deleted: true, MessageId: messageId };
    }
    const rows = await this.Message.findAll({ where: { id: messageId, queue_id: q.id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Message not found');
      e.status = 404;
      throw e;
    }
    const m = rows[0];
    await this.Message.delete(m.id);
    return { deleted: true, MessageId: messageId };
  }

  /**
   * Extend visibility of an in-flight message
   */
  async changeVisibility(queueName, projectId, messageId, visibilitySeconds) {
    this.assertProjectId(projectId);
    const vis = this.parseVisibility(visibilitySeconds);
    const q = await this.getQueueByName(queueName, projectId);
    if (this.useProvider(q)) {
      return this._queueProvider.changeVisibility(
        q.project_id,
        queueName,
        messageId,
        vis
      );
    }
    const rows = await this.Message.findAll({ where: { id: messageId, queue_id: q.id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Message not found');
      e.status = 404;
      throw e;
    }
    const m = rows[0];
    if (!m.locked_until) {
      const e = new Error('Message is not in flight');
      e.status = 400;
      throw e;
    }
    const at = new Date();
    if (vis === 0) {
      await this.Message.update(m.id, { locked_until: null });
    } else {
      const u = new Date(at.getTime() + vis * 1000);
      await this.Message.update(m.id, { locked_until: u.toISOString() });
    }
    return { ok: true, MessageId: messageId };
  }
}

module.exports = { QueueService, MAX_BODY_BYTES, DEFAULT_VISIBILITY, MAX_VISIBILITY };

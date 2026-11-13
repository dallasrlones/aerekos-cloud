'use strict';

/**
 * Queue data-plane seam (W6). Production target: NATS JetStream; cloud: SQS / Pub/Sub / Service Bus.
 * @see docs/architecture/provider-seams.md
 * @see docs/plans/redundancy_audit.md (queue_manager API unchanged)
 */

const { randomUUID } = require('crypto');

const KINDS = ['sqlite', 'local_nats', 'nats'];

function resolveQueueProviderKind(explicit) {
  const raw = explicit || process.env.AEREKOS_QUEUE_PROVIDER || 'sqlite';
  const k = String(raw).toLowerCase();
  return KINDS.includes(k) ? k : 'sqlite';
}

function usesQueueProvider(kind) {
  const k = resolveQueueProviderKind(kind);
  return k === 'local_nats' || k === 'nats';
}

let localStubSingleton;

/**
 * In-memory pub/sub stub mimicking JetStream subject streams until NATS is wired.
 * Subject key: `{projectId}.{queueName}` (JetStream stream name convention placeholder).
 */
class LocalNatsStub {
  constructor() {
    /** @type {Map<string, Array<{ id: string, body: string, group_id: string, dedup_id: string, locked_until: string|null, receive_count: number, created_at: string }>>} */
    this.streams = new Map();
  }

  describe() {
    return {
      backend: 'local_nats_stub',
      implemented: true,
      future: 'NATS JetStream (nats.go / nats.js)',
      env: 'NATS_URL',
      notes: 'In-memory only; does not survive process restart. Swap via AEREKOS_QUEUE_PROVIDER=nats when adapter lands.',
    };
  }

  streamKey(projectId, queueName) {
    return `${projectId}.${queueName}`;
  }

  bucket(projectId, queueName) {
    const key = this.streamKey(projectId, queueName);
    if (!this.streams.has(key)) this.streams.set(key, []);
    return this.streams.get(key);
  }

  isAvailable(m, at) {
    if (!m.locked_until) return true;
    return new Date(m.locked_until) <= at;
  }

  /**
   * @returns {{ MessageId: string, dedup?: boolean }}
   */
  async publish(projectId, queueName, body, extras = {}) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    const bucket = this.bucket(projectId, queueName);
    const dedup = String(extras.dedup_id || '');
    if (dedup) {
      const hit = bucket.find((m) => m.dedup_id === dedup);
      if (hit) return { MessageId: hit.id, dedup: true };
    }
    const row = {
      id: randomUUID(),
      body: text,
      group_id: String(extras.group_id || ''),
      dedup_id: dedup,
      locked_until: null,
      receive_count: 0,
      created_at: new Date().toISOString(),
    };
    bucket.push(row);
    return { MessageId: row.id };
  }

  async depth(projectId, queueName) {
    return this.bucket(projectId, queueName).length;
  }

  /**
   * @returns {{ Messages: object[], QueueName: string }}
   */
  async receive(projectId, queueName, max, opts = {}) {
    const maxN = Math.min(Math.max(1, Number(max) || 1), 10);
    const vis = Math.max(0, Number(opts.visibilitySeconds ?? 30));
    const maxReceive = Math.max(1, Number(opts.maxReceive || 3));
    const dlqName = opts.dlqName || '';
    const fifo = Boolean(opts.fifo);
    const at = new Date();
    const bucket = this.bucket(projectId, queueName);
    const visible = bucket
      .filter((m) => this.isAvailable(m, at))
      .sort((a, b) => {
        if (fifo) {
          const ga = String(a.group_id || '');
          const gb = String(b.group_id || '');
          if (ga !== gb) return ga.localeCompare(gb);
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .slice(0, maxN);

    const untilStr =
      vis === 0 ? null : new Date(at.getTime() + vis * 1000).toISOString();
    const out = [];

    for (const m of visible) {
      const nextCount = (m.receive_count || 0) + 1;
      if (dlqName && nextCount > maxReceive) {
        const idx = bucket.indexOf(m);
        if (idx >= 0) bucket.splice(idx, 1);
        await this.publish(projectId, dlqName, m.body);
        continue;
      }
      m.receive_count = nextCount;
      m.locked_until = untilStr;
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

  async ack(projectId, queueName, receiptHandle) {
    const bucket = this.bucket(projectId, queueName);
    const idx = bucket.findIndex((m) => m.id === receiptHandle);
    if (idx < 0) {
      const e = new Error('Message not found');
      e.status = 404;
      throw e;
    }
    bucket.splice(idx, 1);
    return { deleted: true, MessageId: receiptHandle };
  }

  async changeVisibility(projectId, queueName, messageId, visibilitySeconds) {
    const vis = Math.max(0, Number(visibilitySeconds ?? 0));
    const bucket = this.bucket(projectId, queueName);
    const m = bucket.find((x) => x.id === messageId);
    if (!m) {
      const e = new Error('Message not found');
      e.status = 404;
      throw e;
    }
    if (!m.locked_until) {
      const e = new Error('Message is not in flight');
      e.status = 400;
      throw e;
    }
    m.locked_until =
      vis === 0 ? null : new Date(Date.now() + vis * 1000).toISOString();
    return { ok: true, MessageId: messageId };
  }
}

/** @throws when kind is `nats` (reserved for JetStream adapter). */
function createQueueProvider(kind) {
  const resolved = resolveQueueProviderKind(kind);
  if (resolved === 'sqlite') return null;
  if (resolved === 'local_nats') {
    if (!localStubSingleton) localStubSingleton = new LocalNatsStub();
    return localStubSingleton;
  }
  const e = new Error(`queue provider "${resolved}" is not implemented`);
  e.code = 'QueueProviderNotImplemented';
  e.status = 501;
  throw e;
}

module.exports = {
  KINDS,
  LocalNatsStub,
  resolveQueueProviderKind,
  usesQueueProvider,
  createQueueProvider,
};

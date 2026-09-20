'use strict';

const { randomUUID } = require('crypto');

function skipBroker() {
  return process.env.SKIP_BROKER === '1' || process.env.SKIP_BROKER === 'true';
}

function shouldDeadLetter(receiveCount, maxReceive, dlqName) {
  return Boolean(dlqName) && Number(receiveCount) > Number(maxReceive || 3);
}

function physicalName(projectId, queueName) {
  return `aerekos.${projectId}.${queueName}`;
}

function groupName(queueName) {
  return `aerekos.${queueName}`;
}

let amqpConn;
let amqpCh;
let redisClient;

async function getAmqpChannel() {
  if (skipBroker()) return null;
  if (amqpCh) return amqpCh;
  let amqplib;
  try {
    amqplib = require('amqplib');
  } catch (e) {
    const err = new Error('amqplib is required for engine=rabbitmq');
    err.status = 503;
    throw err;
  }
  const url = process.env.RABBITMQ_URL || 'amqp://aerekos:aerekos@rabbitmq:5672';
  amqpConn = await amqplib.connect(url, { heartbeat: 30 });
  amqpConn.on('error', () => { amqpCh = null; amqpConn = null; });
  amqpConn.on('close', () => { amqpCh = null; amqpConn = null; });
  amqpCh = await amqpConn.createChannel();
  return amqpCh;
}

async function getRedis() {
  if (skipBroker()) return null;
  if (redisClient) return redisClient;
  let Redis;
  try {
    Redis = require('ioredis');
  } catch (e) {
    const err = new Error('ioredis is required for engine=redis_stream');
    err.status = 503;
    throw err;
  }
  const url = process.env.REDIS_URL || 'redis://redis:6379';
  redisClient = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
  await redisClient.connect();
  return redisClient;
}

async function rabbitDeclare(projectId, queueName, dlqName) {
  const ch = await getAmqpChannel();
  const qn = physicalName(projectId, queueName);
  const args = { durable: true };
  if (dlqName) {
    const dlq = physicalName(projectId, dlqName);
    await ch.assertQueue(dlq, { durable: true });
    args['x-dead-letter-exchange'] = '';
    args['x-dead-letter-routing-key'] = dlq;
  }
  await ch.assertQueue(qn, args);
  return qn;
}

async function rabbitPublish(projectId, queueName, body, extras = {}) {
  const ch = await getAmqpChannel();
  const qn = physicalName(projectId, queueName);
  await ch.assertQueue(qn, { durable: true });
  const id = extras.messageId || randomUUID();
  const ok = ch.sendToQueue(qn, Buffer.from(typeof body === 'string' ? body : JSON.stringify(body)), {
    persistent: true,
    messageId: id,
    headers: { group_id: extras.group_id || '', receive_count: 0 },
  });
  if (!ok) await new Promise((r) => ch.once('drain', r));
  return id;
}

const inflight = new Map();

async function rabbitGet(projectId, queueName, max) {
  const ch = await getAmqpChannel();
  const qn = physicalName(projectId, queueName);
  await ch.assertQueue(qn, { durable: true });
  const out = [];
  for (let i = 0; i < max; i += 1) {
    const msg = await ch.get(qn, { noAck: false });
    if (!msg) break;
    const id = msg.properties.messageId || randomUUID();
    const handle = `${qn}:${msg.fields.deliveryTag}:${id}`;
    inflight.set(handle, msg);
    out.push({
      MessageId: id,
      Body: msg.content.toString('utf8'),
      ReceiptHandle: handle,
      receive_count: Number(msg.properties.headers?.receive_count || 0) + 1,
      group_id: msg.properties.headers?.group_id || undefined,
    });
  }
  return out;
}

async function rabbitAck(receipt) {
  const ch = await getAmqpChannel();
  const msg = inflight.get(receipt);
  if (!msg) return;
  ch.ack(msg);
  inflight.delete(receipt);
}

async function rabbitNack(receipt, requeue = true) {
  const ch = await getAmqpChannel();
  const msg = inflight.get(receipt);
  if (!msg) return;
  ch.nack(msg, false, requeue);
  inflight.delete(receipt);
}

async function rabbitDepth(projectId, queueName) {
  const ch = await getAmqpChannel();
  const qn = physicalName(projectId, queueName);
  const q = await ch.checkQueue(qn).catch(() => ({ messageCount: 0 }));
  return q.messageCount || 0;
}

async function rabbitDeleteQueue(projectId, queueName) {
  const ch = await getAmqpChannel();
  await ch.deleteQueue(physicalName(projectId, queueName)).catch(() => {});
}

async function redisEnsureGroup(projectId, queueName) {
  const r = await getRedis();
  const stream = physicalName(projectId, queueName);
  const group = groupName(queueName);
  try {
    await r.xgroup('CREATE', stream, group, '0', 'MKSTREAM');
  } catch (e) {
    if (!String(e.message || e).includes('BUSYGROUP')) throw e;
  }
  return { r, stream, group };
}

async function redisPublish(projectId, queueName, body, extras = {}) {
  const { r, stream } = await redisEnsureGroup(projectId, queueName);
  const id = extras.messageId || randomUUID();
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  await r.xadd(stream, '*', 'id', id, 'body', text, 'group_id', extras.group_id || '');
  return id;
}

async function redisRead(projectId, queueName, max, opts = {}) {
  const { r, stream, group } = await redisEnsureGroup(projectId, queueName);
  const consumer = `http-${process.pid}`;
  const visibilityMs = Math.max(0, Number(opts.visibilityMs || 30000));
  const maxReceive = Math.max(1, Number(opts.maxReceive || 3));
  const dlqName = opts.dlqName || '';
  const out = [];

  async function handleEntries(entries) {
    if (!entries) return;
    for (const [xid, fields] of entries) {
      const map = {};
      for (let i = 0; i < fields.length; i += 2) map[fields[i]] = fields[i + 1];
      const rcKey = `${stream}:rc:${xid}`;
      const next = (Number(await r.get(rcKey)) || 0) + 1;
      await r.set(rcKey, String(next), 'EX', 86400);
      if (shouldDeadLetter(next, maxReceive, dlqName)) {
        await redisPublish(projectId, dlqName, map.body);
        await r.xack(stream, group, xid);
        await r.xdel(stream, xid);
        await r.del(rcKey);
        continue;
      }
      out.push({
        MessageId: map.id || xid,
        Body: map.body,
        ReceiptHandle: JSON.stringify({ stream, group, xid }),
        receive_count: next,
        group_id: map.group_id || undefined,
      });
    }
  }

  try {
    const claimed = await r.xautoclaim(stream, group, consumer, String(visibilityMs), '0-0', 'COUNT', max);
    if (claimed && claimed[1]) await handleEntries(claimed[1]);
  } catch (_) { /* Redis < 6.2 has no XAUTOCLAIM */ }

  if (out.length < max) {
    const res = await r.xreadgroup('GROUP', group, consumer, 'COUNT', max - out.length, 'BLOCK', 10, 'STREAMS', stream, '>');
    if (res) {
      for (const [, entries] of res) await handleEntries(entries);
    }
  }
  return out;
}

async function redisAck(receipt) {
  const r = await getRedis();
  const p = typeof receipt === 'string' ? JSON.parse(receipt) : receipt;
  await r.xack(p.stream, p.group, p.xid);
  await r.xdel(p.stream, p.xid);
  if (p.stream && p.xid) await r.del(`${p.stream}:rc:${p.xid}`);
}

async function redisToDlq(projectId, dlqName, body) {
  await redisPublish(projectId, dlqName, body);
}

async function redisDepth(projectId, queueName) {
  const r = await getRedis();
  const n = await r.xlen(physicalName(projectId, queueName)).catch(() => 0);
  return Number(n) || 0;
}

async function redisDeleteQueue(projectId, queueName) {
  const r = await getRedis();
  await r.del(physicalName(projectId, queueName));
}

module.exports = {
  skipBroker,
  shouldDeadLetter,
  physicalName,
  getAmqpChannel,
  getRedis,
  rabbitDeclare,
  rabbitPublish,
  rabbitGet,
  rabbitAck,
  rabbitNack,
  rabbitDepth,
  rabbitDeleteQueue,
  redisPublish,
  redisRead,
  redisAck,
  redisToDlq,
  redisEnsureGroup,
  redisDepth,
  redisDeleteQueue,
};

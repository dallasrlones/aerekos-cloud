'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');

const {
  LocalNatsStub,
  createQueueProvider,
  resolveQueueProviderKind,
  usesQueueProvider,
} = require('../../shared/queueProvider');
const { createLogProvider, MemoryLogProvider, FileLogProvider } = require('../../shared/logProvider');
const { createMetricsProvider } = require('../../shared/metricsProvider');

describe('W6 observability provider seams', () => {
  describe('QueueProvider / LocalNatsStub', () => {
    test('documents future NATS backend', () => {
      const stub = new LocalNatsStub();
      expect(stub.describe().future).toMatch(/NATS/i);
    });

    test('publish → receive → ack', async () => {
      const stub = new LocalNatsStub();
      const pid = 'p1';
      const q = 'jobs';
      const { MessageId } = await stub.publish(pid, q, { n: 1 });
      const { Messages } = await stub.receive(pid, q, 1, { visibilitySeconds: 30 });
      expect(Messages).toHaveLength(1);
      expect(Messages[0].MessageId).toBe(MessageId);
      await stub.ack(pid, q, MessageId);
      expect(await stub.depth(pid, q)).toBe(0);
    });

    test('soak: publish/consume loop 100 msgs', async () => {
      const stub = new LocalNatsStub();
      const projectId = 'soak-p';
      const queueName = 'soak-jobs';
      const total = 100;

      for (let i = 0; i < total; i += 1) {
        await stub.publish(projectId, queueName, { seq: i });
      }
      expect(await stub.depth(projectId, queueName)).toBe(total);

      const bodies = [];
      let acked = 0;
      while (acked < total) {
        const { Messages } = await stub.receive(projectId, queueName, 10, {
          visibilitySeconds: 30,
        });
        expect(Messages.length).toBeGreaterThan(0);
        for (const m of Messages) {
          bodies.push(JSON.parse(m.Body));
          await stub.ack(projectId, queueName, m.MessageId);
          acked += 1;
        }
      }

      expect(acked).toBe(total);
      expect(bodies.map((b) => b.seq).sort((a, b) => a - b)).toEqual(
        Array.from({ length: total }, (_, i) => i),
      );
      expect(await stub.depth(projectId, queueName)).toBe(0);
    });

    test('createQueueProvider throws for reserved nats kind', () => {
      expect(() => createQueueProvider('nats')).toThrow(/not implemented/i);
    });

    test('resolveQueueProviderKind defaults to sqlite', () => {
      const prev = process.env.AEREKOS_QUEUE_PROVIDER;
      delete process.env.AEREKOS_QUEUE_PROVIDER;
      expect(resolveQueueProviderKind()).toBe('sqlite');
      process.env.AEREKOS_QUEUE_PROVIDER = prev;
    });

    test('AEREKOS_QUEUE_PROVIDER=local_nats enables queue_manager seam', () => {
      const prev = process.env.AEREKOS_QUEUE_PROVIDER;
      process.env.AEREKOS_QUEUE_PROVIDER = 'local_nats';
      expect(usesQueueProvider()).toBe(true);
      expect(createQueueProvider().describe().backend).toBe('local_nats_stub');
      if (prev === undefined) delete process.env.AEREKOS_QUEUE_PROVIDER;
      else process.env.AEREKOS_QUEUE_PROVIDER = prev;
    });
  });

  describe('LogProvider', () => {
    test('memory append and query', async () => {
      const log = new MemoryLogProvider();
      await log.append({ projectId: 'p1', level: 'info', message: 'hello' });
      const { items } = await log.query({ projectId: 'p1' });
      expect(items).toHaveLength(1);
      expect(items[0].message).toBe('hello');
    });

    test('file append writes ndjson', async () => {
      const file = path.join(os.tmpdir(), `aerekos-log-${Date.now()}.ndjson`);
      const log = new FileLogProvider(file);
      await log.append({ projectId: 'p2', level: 'warn', message: 'disk' });
      const raw = fs.readFileSync(file, 'utf8');
      expect(JSON.parse(raw.trim()).message).toBe('disk');
      fs.unlinkSync(file);
    });

    test('createLogProvider loki reserved', () => {
      expect(() => createLogProvider('loki')).toThrow(/not implemented/i);
    });
  });

  describe('MetricsProvider', () => {
    test('renders prometheus text exposition', () => {
      const m = createMetricsProvider('local', { serviceName: 'demo_mgr' });
      m.observeHttp('GET', 200);
      m.observeHttp('GET', 500);
      const text = m.renderText();
      expect(text).toMatch(/aerekos_demo_mgr_http_requests_total/);
      expect(text).toMatch(/method="GET"/);
      expect(text).toMatch(/# TYPE/);
    });
  });
});

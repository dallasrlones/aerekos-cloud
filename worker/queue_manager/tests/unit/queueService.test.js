'use strict';

process.env.SKIP_BROKER = '1';
process.env.SKIP_SERVICE_REGISTRATION = 'true';

const { QueueService } = require('../../api/services/QueueService');

describe('QueueService engines (SKIP_BROKER)', () => {
  const svc = new QueueService();
  const projectId = 'p-22222222-2222-4222-8222-222222222222';

  test('serialize includes engine dlq max_receive depth', () => {
    const q = {
      id: '1',
      name: 'jobs',
      project_id: projectId,
      visibility_timeout_seconds: 30,
      engine: 'fifo',
      dlq: 'jobs-dlq',
      max_receive: 5,
      created_at: '2026-01-01T00:00:00Z',
    };
    expect(svc.serialize(q, 3)).toEqual(expect.objectContaining({
      engine: 'fifo',
      dlq: 'jobs-dlq',
      max_receive: 5,
      depth: 3,
    }));
  });

  test('FIFO receive is ordered by group then time', async () => {
    const q = `fifo-${Date.now()}`;
    await svc.createQueue({ name: q, projectId, engine: 'fifo' });
    await svc.sendMessage(q, projectId, 'b', { group_id: 'g2' });
    await svc.sendMessage(q, projectId, 'a1', { group_id: 'g1' });
    await svc.sendMessage(q, projectId, 'a2', { group_id: 'g1' });
    const rec = await svc.receiveMessages(q, projectId, 3, 0);
    const bodies = rec.Messages.map((m) => m.Body);
    expect(bodies[0]).toBe('a1');
    expect(bodies[1]).toBe('a2');
    expect(bodies[2]).toBe('b');
    await svc.deleteQueue(q, projectId);
  });
});

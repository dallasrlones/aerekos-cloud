const path = require('path');
const os = require('os');
const fs = require('fs');
const { LogOutbox } = require('../../shared/logOutbox/LogOutbox');
const { LogShipper } = require('../../shared/logOutbox/LogShipper');

describe('LogOutbox + LogShipper', () => {
  let dir;
  let db;

  beforeEach(() => {
    dir = path.join(os.tmpdir(), `aerekos-outbox-${Date.now()}`);
    fs.mkdirSync(dir, { recursive: true });
    db = path.join(dir, 'o.db');
  });

  afterEach(() => {
    try {
      const o = new LogOutbox(db);
      o.open();
      o.close();
    } catch {
      /* */
    }
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      /* */
    }
  });

  test('enqueue, takeBatch, removeIds', () => {
    const o = new LogOutbox(db);
    o.open();
    o.enqueue({ projectId: 'p1', level: 'info', message: 'a', source: 't' });
    o.enqueue({ projectId: 'p1', level: 'error', message: 'b' });
    const batch = o.takeBatch(10);
    expect(batch.length).toBe(2);
    o.removeIds(batch.map((r) => r.id));
    expect(o.pendingCount()).toBe(0);
    o.close();
  });

  test('LogShipper posts batch and clears outbox on 201', async () => {
    const o = new LogOutbox(db);
    o.open();
    o.enqueue({ projectId: 'proj-1', level: 'info', message: 'x', source: 's' });
    const posted = { calls: 0, bodies: [] };
    const http = {
      post: (url, body) => {
        posted.calls += 1;
        posted.bodies.push(body);
        return Promise.resolve({ status: 201, data: {} });
      }
    };
    const shipper = new LogShipper({
      outbox: o,
      conductorBaseUrl: 'http://c.test',
      bearerToken: 'tok',
      batchSize: 20,
      axiosInstance: http
    });
    await shipper.flushOnce();
    expect(posted.calls).toBe(1);
    expect(posted.bodies[0].project_id).toBe('proj-1');
    expect(posted.bodies[0].entries[0].message).toBe('x');
    expect(o.pendingCount()).toBe(0);
    o.close();
  });
});

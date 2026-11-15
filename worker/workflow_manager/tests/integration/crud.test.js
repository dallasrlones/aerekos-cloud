const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id='+encodeURIComponent(id);
describe('workflow_manager crud', () => {
  const pid = 'p-workflow_manager-crud-'+Date.now();
  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/machines').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;
    const g = await request(app).get('/api/v1/machines/'+id+'?'+Q(pid));
    expect(g.status).toBe(200);
    const u = await request(app).patch('/api/v1/machines/'+id+'?'+Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');
    const d = await request(app).delete('/api/v1/machines/'+id+'?'+Q(pid));
    expect(d.status).toBe(200);
  });

  test('run skips email/sms/slack', async () => {
    const c = await request(app).post('/api/v1/machines').send({
      project_id: pid,
      name: 'notify',
      definition: JSON.stringify({
        steps: [
          { type: 'email', to: 'a@b.c' },
          { type: 'sms' },
          { type: 'slack' },
          { type: 'wait', ms: 0 },
        ],
      }),
    });
    expect(c.status).toBe(201);
    const r = await request(app).post('/api/v1/machines/'+c.body.item.id+'/run').send({ project_id: pid });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('succeeded');
    expect(r.body.steps.filter((s) => s.skipped)).toHaveLength(3);
    // outboundSend returns queue_only when delivery is disabled/queued
    expect(['outbound_disabled', 'queue_only']).toContain(r.body.steps[0].reason);
    expect(r.body.item.status).toBe('succeeded');
  });
});


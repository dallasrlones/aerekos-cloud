'use strict';

const request = require('supertest');
const app = require('../../index.js');
const Q = (id) => 'project_id=' + encodeURIComponent(id);

describe('trace_manager crud + OTLP', () => {
  const pid = 'p-trace_manager-crud-' + Date.now();

  test('create get update delete', async () => {
    const c = await request(app).post('/api/v1/traces').send({ project_id: pid, name: 'n1' });
    expect(c.status).toBe(201);
    const id = c.body.item.id;

    const list = await request(app).get('/api/v1/traces?' + Q(pid));
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    expect(list.body.items.some((it) => it.id === id)).toBe(true);

    const g = await request(app).get('/api/v1/traces/' + id + '?' + Q(pid));
    expect(g.status).toBe(200);

    const u = await request(app).patch('/api/v1/traces/' + id + '?' + Q(pid)).send({ name: 'n2' });
    expect(u.status).toBe(200);
    expect(u.body.item.name).toBe('n2');

    const d = await request(app).delete('/api/v1/traces/' + id + '?' + Q(pid));
    expect(d.status).toBe(200);
  });

  test('OTLP ingest then spans list/query', async () => {
    const traceId = 'aabbccddeeff00112233445566778899';
    const ingest = await request(app).post('/v1/traces').send({
      project_id: pid,
      resourceSpans: [{
        scopeSpans: [{
          spans: [{
            traceId,
            spanId: '1122334455667788',
            name: 'handler',
            startTimeUnixNano: '10',
            endTimeUnixNano: '20',
          }],
        }],
      }],
    });
    expect(ingest.status).toBe(200);
    expect(ingest.body.accepted).toBeGreaterThanOrEqual(1);

    const spans = await request(app).get('/api/v1/spans?' + Q(pid) + '&trace_id=' + encodeURIComponent(traceId));
    expect(spans.status).toBe(200);
    expect(Array.isArray(spans.body.spans)).toBe(true);
    expect(spans.body.spans.some((s) => s.trace_id === traceId && s.name === 'handler')).toBe(true);

    const q = await request(app).get('/api/v1/query?' + Q(pid) + '&q=' + encodeURIComponent(traceId));
    expect(q.status).toBe(200);
    expect(q.body.spans.some((s) => s.trace_id === traceId)).toBe(true);
  });
});

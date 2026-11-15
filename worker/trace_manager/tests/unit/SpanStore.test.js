'use strict';

const path = require('path');
const os = require('os');
const fs = require('fs');

describe('SpanStore', () => {
  let SpanStore;
  let store;
  let dbPath;

  beforeEach(() => {
    const dir = path.join(os.tmpdir(), 'aerekos-trace_manager-span-unit');
    fs.mkdirSync(dir, { recursive: true });
    dbPath = path.join(dir, `spans_${Date.now()}_${process.pid}.db`);
    process.env.DATABASE_PATH = dbPath;
    jest.resetModules();
    ({ SpanStore } = require('../../api/services/SpanStore'));
    store = new SpanStore();
  });

  afterEach(() => {
    try { store.db.close(); } catch { /* ignore */ }
    try { fs.unlinkSync(`${dbPath}.spans`); } catch { /* ignore */ }
  });

  test('ingest accepts OTLP resourceSpans and list filters by project/trace', () => {
    const out = store.ingest({
      resourceSpans: [{
        resource: { attributes: [{ key: 'service.name', value: { stringValue: 'demo' } }] },
        scopeSpans: [{
          spans: [{
            traceId: 'aabbccddeeff00112233445566778899',
            spanId: '1122334455667788',
            name: 'http.get',
            startTimeUnixNano: '1',
            endTimeUnixNano: '2',
            attributes: [{ key: 'http.method', value: { stringValue: 'GET' } }],
          }],
        }],
      }],
    }, 'p1');

    expect(out.accepted).toBe(1);
    expect(out.spans[0].name).toBe('http.get');

    const listed = store.list({ project_id: 'p1', trace_id: 'aabbccddeeff00112233445566778899' });
    expect(listed).toHaveLength(1);
    expect(listed[0].attributes['http.method']).toBe('GET');
  });

  test('list requires project_id', () => {
    expect(() => store.list({})).toThrow(/project_id/);
  });
});

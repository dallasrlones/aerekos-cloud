'use strict';

const { purge, putCacheRule, putWafNote } = require('../../api/services/CloudflareEdge');

describe('CloudflareEdge honesty', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.CLOUDFLARE_API_TOKEN = prev.CLOUDFLARE_API_TOKEN;
    process.env.CLOUDFLARE_ZONE_ID = prev.CLOUDFLARE_ZONE_ID;
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
  });

  test('purge without creds returns purged:false', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    delete process.env.CLOUDFLARE_ZONE_ID;
    const r = await purge({});
    expect(r.purged).toBe(false);
    expect(r.reason).toMatch(/missing/i);
  });

  test('putCacheRule never claims applied:true', async () => {
    delete process.env.CLOUDFLARE_API_TOKEN;
    const a = await putCacheRule({ name: 'n', expression: '1', edge_ttl_seconds: 60 });
    expect(a.applied).toBe(false);

    process.env.CLOUDFLARE_API_TOKEN = 'tok';
    process.env.CLOUDFLARE_ZONE_ID = 'zone';
    const b = await putCacheRule({ name: 'n', expression: '1', edge_ttl_seconds: 60 });
    expect(b.applied).toBe(false);
    expect(b.parked).toBe(true);
  });

  test('putWafNote is intent-only (applied:false)', async () => {
    const r = await putWafNote({ name: 'w', rate_limit: 30 });
    expect(r.applied).toBe(false);
    expect(r.parked).toBe(true);
    expect(r.rate_limit).toBe(30);
  });
});

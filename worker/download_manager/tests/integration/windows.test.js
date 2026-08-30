const request = require('supertest');
const app = require('../../index.js');
const { inWindow } = require('../../api/services/DownloadService');

describe('download_manager windows + quick-add', () => {
  const pid = 'p-dl-' + Date.now();
  test('midnight wrap 22:00-06:00', () => {
    const win = { start: '22:00', end: '06:00', days: JSON.stringify([0,1,2,3,4,5,6]) };
    expect(inWindow(win, new Date('2026-01-02T23:00:00'))).toBe(true);
    expect(inWindow(win, new Date('2026-01-02T03:00:00'))).toBe(true);
    expect(inWindow(win, new Date('2026-01-02T12:00:00'))).toBe(false);
  });

  test('quick-add with SKIP_DOWNLOAD', async () => {
    process.env.SKIP_DOWNLOAD = '1';
    const d = await request(app).post('/api/v1/ensure-defaults').send({ project_id: pid });
    expect(d.status).toBe(200);
    expect(d.body.defaults.window.name).toBe('overnight');
    const add = await request(app).post('/api/v1/quick-add').send({
      project_id: pid,
      urls: ['https://youtu.be/dQw4w9wgGcQ', 'magnet:?xt=urn:btih:abc'],
      window: 'overnight',
    });
    expect(add.status).toBe(201);
    expect(add.body.items).toHaveLength(2);
    const midday = await request(app).post('/api/v1/tick').send({ now: '2026-01-02T12:00:00' });
    expect(midday.body.started || []).toHaveLength(0);
    const night = await request(app).post('/api/v1/tick').send({ now: '2026-01-02T23:30:00' });
    expect((night.body.started || []).length).toBeGreaterThan(0);
  });
});

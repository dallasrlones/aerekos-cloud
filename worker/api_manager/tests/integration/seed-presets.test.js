const request = require('supertest');
const app = require('../../index.js');
const { listPresets } = require('../../../shared/gatewayPresets');

describe('api_manager seed-presets', () => {
  const projectId = `proj-seed-${Date.now()}`;

  test('seeds all gateway presets idempotently', async () => {
    const first = await request(app)
      .post('/api/v1/endpoints/seed-presets')
      .send({ project_id: projectId });
    expect(first.status).toBe(200);
    expect(first.body.created.length).toBe(listPresets().length);

    const second = await request(app)
      .post('/api/v1/endpoints/seed-presets')
      .send({ project_id: projectId });
    expect(second.status).toBe(200);
    expect(second.body.updated.length).toBe(listPresets().length);

    const list = await request(app)
      .get(`/api/v1/endpoints?project_id=${encodeURIComponent(projectId)}`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBe(listPresets().length);
    expect(list.body.items.some((r) => r.name === 'ai-llm-chat')).toBe(true);
    expect(list.body.items.some((r) => r.name === 'data-collection-list')).toBe(true);
  });
});

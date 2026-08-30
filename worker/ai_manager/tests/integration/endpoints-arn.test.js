const request = require('supertest');
const app = require('../../index.js');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

describe('ai_manager endpoints ARN', () => {
  test('provider create returns arn + invoke_scope', async () => {
    const name = `e2e-ep-${Date.now()}`;
    const c = await request(app)
      .post('/api/v1/providers')
      .send({
        project_id: PID,
        name,
        capability: 'llm',
        provider: 'ollama',
        provider_type: 'ollama',
        endpoint: 'http://127.0.0.1:11434',
      });
    expect(c.status).toBe(201);
    expect(c.body.item.arn).toBe(`arn:aerekos:${PID}:ai:llm:endpoint/${name}`);

    const l = await request(app).get('/api/v1/providers').query({ project_id: PID, capability: 'llm' });
    expect(l.status).toBe(200);
    const found = (l.body.items || []).find((i) => i.name === name);
    expect(found?.arn).toContain(`:ai:llm:endpoint/${name}`);
    expect(found?.invoke_scope).toBe('ai:InvokeLlm');

    await request(app).delete(`/api/v1/providers/${c.body.item.id}`).query({ project_id: PID });
  });
});

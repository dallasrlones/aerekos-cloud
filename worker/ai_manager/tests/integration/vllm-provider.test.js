const request = require('supertest');
const app = require('../../index.js');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

describe('ai_manager vllm provider', () => {
  test('provider create accepts vllm type and returns arn', async () => {
    const name = `e2e-vllm-${Date.now()}`;
    const c = await request(app)
      .post('/api/v1/providers')
      .send({
        project_id: PID,
        name,
        capability: 'llm',
        provider: 'vllm',
        endpoint: 'http://127.0.0.1:8000',
        model: 'cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit',
      });
    expect(c.status).toBe(201);
    expect(c.body.item.arn).toBe(`arn:aerekos:${PID}:ai:llm:endpoint/${name}`);
    expect(c.body.item.provider).toBe('vllm');

    await request(app).delete(`/api/v1/providers/${c.body.item.id}`).query({ project_id: PID });
  });
});

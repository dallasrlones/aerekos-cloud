const request = require('supertest');
const app = require('../../index.js');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

describe('api_manager gateway match', () => {
  const suffix = `gw${Date.now()}`;

  test('match resolves ARN and proxy target', async () => {
    const created = await request(app)
      .post('/api/v1/endpoints')
      .send({
        project_id: `proj-gw-${suffix}`,
        name: `ai-llm-${suffix}`,
        method: 'POST',
        public_path: '/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat',
        target_service: 'ai_manager',
        target_path: '/api/v1/llm/chat',
        resource_arn_template: 'arn:aerekos:{project_id}:ai:llm:endpoint/{endpoint_name}',
        required_scope: 'ai:InvokeLlm',
      });
    expect(created.status).toBe(201);

    const path = `/v1/projects/${PID}/ai/llm/e2e-endpoint/chat`;
    const match = await request(app)
      .post('/api/v1/endpoints/match')
      .send({ method: 'POST', path });
    expect(match.status).toBe(200);
    expect(match.body.match.target_service).toBe('ai_manager');
    expect(match.body.match.resource_arn).toBe(`arn:aerekos:${PID}:ai:llm:endpoint/e2e-endpoint`);
    expect(match.body.match.proxy_path).toContain('/api/services/ai_manager');
  });

  test('rejects route without ARN template', async () => {
    const r = await request(app)
      .post('/api/v1/endpoints')
      .send({
        project_id: `proj-bad-${suffix}`,
        name: `bad-${suffix}`,
        method: 'GET',
        public_path: '/v1/x',
        target_service: 'ai_manager',
        target_path: '/api/v1/llm/chat',
        resource_arn_template: 'not-valid',
      });
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('INVALID_ARN_TEMPLATE');
  });
});

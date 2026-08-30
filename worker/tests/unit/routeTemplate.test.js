const { matchPath, fillTemplate, buildPublicUrl } = require('../../shared/routeTemplate');

describe('routeTemplate', () => {
  test('matches path params', () => {
    const hit = matchPath(
      '/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat',
      '/v1/projects/d58d38ec-c168-4b79-9ef4-11579f4eecaf/ai/llm/my-llm/chat',
    );
    expect(hit.params.project_id).toBe('d58d38ec-c168-4b79-9ef4-11579f4eecaf');
    expect(hit.params.endpoint_name).toBe('my-llm');
  });

  test('fillTemplate builds ARN', () => {
    const arn = fillTemplate(
      'arn:aerekos:{project_id}:ai:llm:endpoint/{endpoint_name}',
      { project_id: 'abc', endpoint_name: 'x' },
    );
    expect(arn).toBe('arn:aerekos:abc:ai:llm:endpoint/x');
  });

  test('buildPublicUrl', () => {
    const url = buildPublicUrl(
      'https://cloudapi.aerekos.com',
      '/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat',
      { project_id: 'p1', endpoint_name: 'demo' },
    );
    expect(url).toBe('https://cloudapi.aerekos.com/v1/projects/p1/ai/llm/demo/chat');
  });
});

jest.mock('../../api/services/ServiceManager', () => ({
  getInstance: jest.fn(() => ({})),
}));
jest.mock('../../api/repos/WorkerRepository', () => ({}));

const { PolicyEvaluator } = require('../../api/services/PolicyEvaluator');

describe('PolicyEvaluator', () => {
  test('evaluateLocal applies deny-over-allow', () => {
    const ev = new PolicyEvaluator();
    const result = ev.evaluateLocal(
      [
        { effect: 'allow', document: { actions: ['storage:*'], resources: ['*'] } },
        { effect: 'deny', document: { actions: ['storage:DeleteObject'], resources: ['arn:aerekos:d57d380d-acfe-49b0-b5a9-ba973892bc8b:storage:bucket/x'] } },
      ],
      {
        action: 'storage:DeleteObject',
        resourceArn: 'arn:aerekos:d57d380d-acfe-49b0-b5a9-ba973892bc8b:storage:bucket/x',
      },
    );
    expect(result.allowed).toBe(false);
    expect(result.matched).toBe('deny');
  });

  test('evaluate proxies to iam_manager', async () => {
    const mockManager = {
      proxyServiceRequest: jest.fn().mockResolvedValue({
        status: 200,
        data: { evaluation: { allowed: true, matched: 'allow', reason: 'ok' } },
      }),
    };
    const ev = new PolicyEvaluator({ serviceManager: mockManager });
    const result = await ev.evaluate({
      projectId: 'd57d380d-acfe-49b0-b5a9-ba973892bc8b',
      roleName: 'reader',
      action: 'storage:ListBucket',
      resourceArn: 'arn:aerekos:d57d380d-acfe-49b0-b5a9-ba973892bc8b:storage:bucket/x',
    });
    expect(result.allowed).toBe(true);
    expect(mockManager.proxyServiceRequest).toHaveBeenCalledWith(
      'iam_manager',
      'POST',
      '/api/v1/evaluate',
      expect.objectContaining({ role_name: 'reader', action: 'storage:ListBucket' }),
      {},
      'd57d380d-acfe-49b0-b5a9-ba973892bc8b',
    );
  });
});

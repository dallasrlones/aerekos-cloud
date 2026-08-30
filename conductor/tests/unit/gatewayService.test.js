jest.mock('../../api/services/ServiceManager', () => ({
  getInstance: jest.fn(() => ({})),
}));
jest.mock('../../api/repos/WorkerRepository', () => ({}));

const { GatewayService } = require('../../api/services/GatewayService');

describe('GatewayService', () => {
  test('assertAppAccess denies wrong resource', () => {
    const gw = new GatewayService();
    const denied = gw.assertAppAccess(
      {
        isAppCredential: true,
        auth: { resources: ['arn:aerekos:p:ai:llm:endpoint/other'], scope: 'ai:InvokeLlm' },
      },
      {
        resource_arn: 'arn:aerekos:p:ai:llm:endpoint/demo',
        required_scope: 'ai:InvokeLlm',
      },
    );
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('ResourceNotAllowed');
  });

  test('assertAppAccess allows matching resource and scope', () => {
    const gw = new GatewayService();
    const arn = 'arn:aerekos:p:ai:llm:endpoint/demo';
    const denied = gw.assertAppAccess(
      {
        isAppCredential: true,
        auth: { resources: [arn], scope: 'ai:InvokeLlm' },
      },
      { resource_arn: arn, required_scope: 'ai:InvokeLlm' },
    );
    expect(denied).toBeNull();
  });
});

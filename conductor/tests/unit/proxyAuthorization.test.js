'use strict';

jest.mock('../../api/utils/authManagerToken', () => ({
  isGated: jest.fn(),
  getToken: jest.fn(),
}));

const authManagerToken = require('../../api/utils/authManagerToken');
const { authorizationForProxy } = require('../../api/utils/proxyAuthorization');

describe('authorizationForProxy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('passthrough app credential bearer', async () => {
    const token = await authorizationForProxy(
      { isAppCredential: true, bearerToken: 'app-jwt' },
      'ai_manager'
    );
    expect(token).toBe('app-jwt');
    expect(authManagerToken.getToken).not.toHaveBeenCalled();
  });

  test('passthrough service registry token', async () => {
    const token = await authorizationForProxy(
      { service: { token: 'svc-tok' }, tokenType: 'service' },
      'storage_manager'
    );
    expect(token).toBe('svc-tok');
  });

  test('user on gated service uses conductor client token', async () => {
    authManagerToken.isGated.mockReturnValue(true);
    authManagerToken.getToken.mockResolvedValue('conductor-client');
    const token = await authorizationForProxy(
      { tokenType: 'user', bearerToken: 'user-jwt' },
      'ai_manager'
    );
    expect(token).toBe('conductor-client');
    expect(authManagerToken.isGated).toHaveBeenCalledWith('ai_manager');
  });

  test('user on ungated service keeps bearer', async () => {
    authManagerToken.isGated.mockReturnValue(false);
    const token = await authorizationForProxy(
      { tokenType: 'user', bearerToken: 'user-jwt' },
      'metrics_manager'
    );
    expect(token).toBe('user-jwt');
    expect(authManagerToken.getToken).not.toHaveBeenCalled();
  });
});

'use strict';

const mockEvaluate = jest.fn();
jest.mock('../../api/services/PolicyEvaluator', () => ({
  evaluate: (...args) => mockEvaluate(...args),
}));

const { requireIamAccess } = require('../../api/middleware/requireIamAccess');

describe('requireIamAccess', () => {
  const prevEnforce = process.env.IAM_ENFORCE_PROXY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.IAM_ENFORCE_PROXY = 'true';
  });

  afterAll(() => {
    process.env.IAM_ENFORCE_PROXY = prevEnforce;
  });

  test('IAM deny from iam_manager returns 403 IamDenied', async () => {
    mockEvaluate.mockResolvedValue({ allowed: false, reason: 'explicit deny', matched: 'deny' });
    const mw = requireIamAccess({ serviceName: 'storage_manager' });
    const req = {
      headers: {
        'x-aerekos-action': 'storage:DeleteObject',
        'x-aerekos-role': 'reader',
      },
      query: { project_id: 'd57d380d-acfe-49b0-b5a9-ba973892bc8b' },
      method: 'DELETE',
      params: { serviceName: 'storage_manager' },
      user: { role: 'member', id: 1 },
      tokenType: 'user',
      isAppCredential: false,
    };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await mw(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: expect.objectContaining({
        code: 'IamDenied',
        status: 403,
        action: 'storage:DeleteObject',
      }),
    });
  });

  test('skips IAM for app credentials', async () => {
    const mw = requireIamAccess();
    const req = { tokenType: 'app', isAppCredential: true, headers: {}, query: {}, user: {} };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await mw(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(mockEvaluate).not.toHaveBeenCalled();
  });
});

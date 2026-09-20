'use strict';

jest.mock('axios');
const axios = require('axios');
const { registerWithConductor } = require('../../api/utils/serviceRegistration');

describe('ai_manager registerWithConductor', () => {
  const prev = { ...process.env };

  afterEach(() => {
    process.env.CONDUCTOR_URL = prev.CONDUCTOR_URL;
    process.env.PORT = prev.PORT;
    jest.resetAllMocks();
  });

  test('registers env PORT as-is and does not hop', async () => {
    process.env.CONDUCTOR_URL = 'http://conductor.test';
    process.env.PORT = '3126';
    axios.post.mockResolvedValue({ data: { service_id: 'svc-1' } });
    await registerWithConductor();
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(axios.post.mock.calls[0][1].port).toBe(3126);
    expect(axios.post.mock.calls[0][0]).toBe('http://conductor.test/api/services/register');
  });
});

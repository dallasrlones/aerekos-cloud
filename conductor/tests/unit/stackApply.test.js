'use strict';

process.env.SKIP_STACK_PROVISION = '1';
const StackService = require('../../api/services/StackService');

describe('stack apply wanted', () => {
  test('enableWanted strips auth_manager and vllm; skip does not POST', async () => {
    const out = await StackService.enableWanted('scratch', ['queue_manager', 'auth_manager', 'vllm']);
    expect(out.skipped).toBe(true);
    expect(out.enabled).toEqual(['queue_manager']);
  });

  test('apply refuses production UUID before provision', async () => {
    await expect(StackService.apply('ea370977-3aff-4c76-95a6-a0c50fd2bce7')).rejects.toMatchObject({ status: 403 });
  });
});

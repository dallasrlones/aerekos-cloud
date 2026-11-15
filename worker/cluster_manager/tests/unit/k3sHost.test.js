const { detectK3s, installK3s } = require('../../api/services/K3sHost');

describe('K3sHost', () => {
  test('detectK3s returns installed boolean and paths', () => {
    const d = detectK3s();
    expect(d).toHaveProperty('installed');
    expect(typeof d.installed).toBe('boolean');
    expect(d).toHaveProperty('k3s_path');
    expect(d).toHaveProperty('kubectl_path');
  });

  test('installK3s without confirm throws 400', async () => {
    await expect(installK3s({})).rejects.toMatchObject({
      message: expect.stringMatching(/confirm/),
      status: 400,
    });
  });

  test('installK3s with confirm skips when SKIP_HOST_PATCH', async () => {
    const out = await installK3s({ confirm: true });
    expect(out.skipped).toBe(true);
    expect(out.reason).toBe('SKIP_HOST_PATCH');
  });
});

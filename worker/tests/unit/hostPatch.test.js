const hostPatch = require('../../utils/hostPatch');

describe('hostPatch', () => {
  const prev = process.env.SKIP_HOST_PATCH;

  afterEach(() => {
    process.env.SKIP_HOST_PATCH = prev;
  });

  test('SKIP_HOST_PATCH returns mocked probe without exec', async () => {
    process.env.SKIP_HOST_PATCH = '1';
    const result = await hostPatch.probe();
    expect(result.mock).toBe(true);
    expect(result.os.supported).toBe(true);
    expect(result.os.updates_available).toBe(0);
    expect(result.docker.supported).toBe(true);
    expect(result.docker.updates_available).toBe(0);
    expect(result.probed_at).toBeTruthy();
  });

  test('check is an alias of probe', async () => {
    process.env.SKIP_HOST_PATCH = '1';
    expect(hostPatch.check).toBe(hostPatch.probe);
    const result = await hostPatch.check();
    expect(result.mock).toBe(true);
  });

  test('SKIP_HOST_PATCH update does not exec', async () => {
    process.env.SKIP_HOST_PATCH = '1';
    const result = await hostPatch.update({ target: 'os' });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(true);
    expect(result.reboot_required).toBe(false);
  });

  test('update rejects invalid target', async () => {
    process.env.SKIP_HOST_PATCH = '1';
    await expect(hostPatch.update({ target: 'firmware' })).rejects.toThrow(/target must be/);
  });

  test('parseAptListUpgradable extracts docker and os packages', () => {
    const text = [
      'Listing...',
      'libssl3/noble-updates 3.0.13-0ubuntu3.5 amd64 [upgradable from: 3.0.13-0ubuntu3.4]',
      'docker-ce/noble 5:27.3.1-1~ubuntu.24.04~noble amd64 [upgradable from: 5:27.2.0-1~ubuntu.24.04~noble]',
      'docker.io/noble 27.1.0-1 amd64 [upgradable from: 26.1.0-1]',
    ].join('\n');
    const pkgs = hostPatch.parseAptListUpgradable(text);
    expect(pkgs.map((p) => p.name)).toEqual(['libssl3', 'docker-ce', 'docker.io']);
    expect(pkgs[1].candidate).toContain('27.3.1');
  });

  test('parseAptGetSimulate extracts Inst lines', () => {
    const text = [
      'NOTE: This is only a simulation!',
      'Inst libssl3 [3.0.13-0ubuntu3.4] (3.0.13-0ubuntu3.5 Ubuntu:24.04/noble-updates [amd64])',
      'Conf libssl3 (3.0.13-0ubuntu3.5 Ubuntu:24.04/noble-updates [amd64])',
    ].join('\n');
    const pkgs = hostPatch.parseAptGetSimulate(text);
    expect(pkgs).toHaveLength(1);
    expect(pkgs[0].name).toBe('libssl3');
  });

  test('isDebianFamily accepts ubuntu and debian-like', () => {
    expect(hostPatch.isDebianFamily({ id: 'ubuntu', id_like: 'debian' })).toBe(true);
    expect(hostPatch.isDebianFamily({ id: 'debian', id_like: '' })).toBe(true);
    expect(hostPatch.isDebianFamily({ id: 'pop', id_like: 'ubuntu debian' })).toBe(true);
    expect(hostPatch.isDebianFamily({ id: 'fedora', id_like: 'rhel' })).toBe(false);
    expect(hostPatch.isDebianFamily(null)).toBe(false);
  });
});

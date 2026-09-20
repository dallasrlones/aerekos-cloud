const { sameIsland, classifyWorker, workerReachUrls } = require('../../api/utils/networkIslands');

describe('networkIslands', () => {
  it('treats 192.168.0.x as one island', () => {
    expect(sameIsland('192.168.0.141', '192.168.0.221')).toBe(true);
    expect(sameIsland('192.168.0.141', '10.0.0.5')).toBe(false);
  });

  it('classifies same-LAN workers as lan', () => {
    const w = { id: '1', ip_address: '192.168.0.222' };
    const c = classifyWorker(w, [], '192.168.0.141');
    expect(c.island).toBe('lan');
    expect(c.prefer_lan).toBe(true);
  });

  it('prefers LAN url before overlay', () => {
    const urls = workerReachUrls({
      ip_address: '192.168.0.221',
      hostname: 'ubuntu',
      resources: { overlay_ip: '100.64.0.3' },
    }, 3116);
    expect(urls[0]).toBe('http://192.168.0.221:3116');
    expect(urls).toContain('http://100.64.0.3:3116');
    expect(urls.some((u) => u.includes('aerekos.com'))).toBe(false);
  });
});

const {
  knownTunnels,
  cloudConsoleTunnels,
  companionTunnels,
} = require('../../api/config/knownTunnels');

describe('knownTunnels', () => {
  it('uses Cloudflare names and default_bind on aerekos not prod-mini', () => {
    const named = knownTunnels();
    const ids = named.map((t) => t.cf_tunnel_id);
    expect(ids).toContain('d33010ac-473f-496b-938f-1bac352e415d');
    expect(ids).toContain('17dd5eb6-a5a9-411c-8d2e-50d8f6617b18');
    expect(named.find((t) => t.display_name === 'aerekos').default_bind).toBe(true);
    expect(named.find((t) => t.display_name === 'prod-mini').default_bind).toBe(false);
    expect(named.find((t) => t.display_name === 'orin-agx-dev-kit').device_hostname).toBe('ubuntu');
  });

  it('lists down tunnels as read-only (never default_bind)', () => {
    const named = knownTunnels();
    for (const name of ['Docunu Self Host', 'aerekos-dev', 'pi4']) {
      const row = named.find((t) => t.display_name === name);
      expect(row).toBeTruthy();
      expect(row.status).toBe('down');
      expect(row.default_bind).toBe(false);
      expect(row.in_cloud_console).toBe(false);
    }
  });

  it('shows only prod-mini, dev-mini, and orin in the cloud console', () => {
    const names = cloudConsoleTunnels().map((t) => t.display_name).sort();
    expect(names).toEqual(['dev-mini', 'orin-agx-dev-kit', 'prod-mini']);
    expect(knownTunnels().find((t) => t.display_name === 'aerekos').in_cloud_console).toBe(false);
  });

  it('attaches the aerekos HTTP connector as a prod-mini companion', () => {
    const companions = companionTunnels('prod-mini');
    expect(companions.map((t) => t.display_name)).toEqual(['aerekos']);
    expect(companionTunnels('dev-mini')).toEqual([]);
  });
});

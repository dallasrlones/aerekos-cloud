'use strict';

/** Live Cloudflare inventory. Console list is prod-mini / dev-mini / orin only. */
const KNOWN_TUNNELS = [
  { display_name: 'aerekos', cf_tunnel_id: 'd33010ac-473f-496b-938f-1bac352e415d', device_hostname: 'aerekos-server', default_bind: true, origin_mode: 'host', status: 'healthy', in_cloud_console: false, companion_of: 'prod-mini' },
  { display_name: 'prod-mini', cf_tunnel_id: '17dd5eb6-a5a9-411c-8d2e-50d8f6617b18', device_hostname: 'aerekos-server', default_bind: false, origin_mode: 'host', status: 'healthy', in_cloud_console: true },
  { display_name: 'dev-mini', cf_tunnel_id: '689acb6e-c4c3-4c2a-9e32-898e3c2780a0', device_hostname: 'aerekos-M5-PLUS', default_bind: true, origin_mode: 'host', status: 'healthy', in_cloud_console: true },
  { display_name: 'orin-agx-dev-kit', cf_tunnel_id: 'd0efca3a-9127-47ea-a083-9461df4cb25d', device_hostname: 'ubuntu', default_bind: true, origin_mode: 'host', status: 'healthy', in_cloud_console: true },
  { display_name: 'Docunu Self Host', cf_tunnel_id: '', device_hostname: '', default_bind: false, origin_mode: 'host', status: 'down', in_cloud_console: false },
  { display_name: 'aerekos-dev', cf_tunnel_id: '', device_hostname: '', default_bind: false, origin_mode: 'host', status: 'down', in_cloud_console: false },
  { display_name: 'pi4', cf_tunnel_id: '', device_hostname: '', default_bind: false, origin_mode: 'host', status: 'down', in_cloud_console: false },
];

function knownTunnels() {
  return KNOWN_TUNNELS.map((t) => ({ ...t }));
}

function isCloudConsoleTunnel(t) {
  return t && t.in_cloud_console === true;
}

function cloudConsoleTunnels() {
  return knownTunnels().filter(isCloudConsoleTunnel);
}

function companionTunnels(displayName) {
  const name = String(displayName || '').toLowerCase();
  return knownTunnels().filter((t) => String(t.companion_of || '').toLowerCase() === name);
}

module.exports = {
  KNOWN_TUNNELS,
  knownTunnels,
  isCloudConsoleTunnel,
  cloudConsoleTunnels,
  companionTunnels,
};

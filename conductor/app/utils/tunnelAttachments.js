const CONSOLE_NAMES = new Set(['prod-mini', 'dev-mini', 'orin-agx-dev-kit']);

export function isCloudConsoleTunnel(t) {
  if (!t) return false;
  if (t.in_cloud_console === true) return true;
  const name = String(t.display_name || t.name || '').toLowerCase();
  return CONSOLE_NAMES.has(name);
}

export function joinHostname(subdomain, domain) {
  const d = String(domain || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const s = String(subdomain || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!d) return '';
  return s ? `${s}.${d}` : d;
}

export function splitHostname(hostname) {
  if (!hostname) return { hostname: '(catch-all)', domain: '', subdomain: '' };
  const parts = String(hostname).split('.');
  if (parts.length >= 3) {
    return {
      hostname,
      subdomain: parts.slice(0, -2).join('.'),
      domain: parts.slice(-2).join('.'),
    };
  }
  return { hostname, subdomain: '', domain: hostname };
}

export function portFromService(service) {
  const m = String(service || '').match(/:(\d+)(?:\s|$|\/)/);
  return m ? m[1] : '';
}

export function attachmentFromRule(rule, tunnel) {
  const service = rule?.service || '';
  const { hostname, domain, subdomain } = splitHostname(rule?.hostname);
  return {
    hostname,
    domain,
    subdomain,
    path: rule?.path || '',
    port: portFromService(service),
    service,
    tunnel_name: tunnel?.display_name || tunnel?.name || '',
    tunnel_id: tunnel?.id || tunnel?.cf_tunnel_id || '',
    cf_tunnel_id: tunnel?.cf_tunnel_id || tunnel?.id || '',
  };
}

export function isCatchAll(rule) {
  return !rule?.hostname && String(rule?.service || '').includes('http_status');
}

export function hostnameOnConsoleFleet(hostname, namedTunnels) {
  const tun = (namedTunnels || []).find(
    (t) => t.cf_tunnel_id === hostname.tunnel_id || t.id === hostname.tunnel_id
  );
  if (!tun) return false;
  return isCloudConsoleTunnel(tun) || Boolean(tun.companion_of);
}

export function consoleTunnelsFromNamed(namedTunnels, dbTunnels = []) {
  const named = (namedTunnels || []).filter(isCloudConsoleTunnel);
  return named.map((n) => {
    const row = (dbTunnels || []).find(
      (t) => t.cf_tunnel_id === n.cf_tunnel_id || t.id === n.id || t.id === n.cf_tunnel_id
    );
    return {
      ...row,
      ...n,
      id: row?.id || n.id || n.cf_tunnel_id,
      status: n.status || row?.status,
    };
  });
}

export function companionTunnelsFor(tunnel, namedTunnels) {
  const name = String(tunnel?.display_name || tunnel?.name || '').toLowerCase();
  return (namedTunnels || []).filter(
    (t) => String(t.companion_of || '').toLowerCase() === name
  );
}

/** Host-published port from Docker inspect or a simple "80" / "80/tcp" map. */
export function publishedHostPort(binding) {
  if (binding == null || binding === '') return '';
  if (typeof binding === 'string' || typeof binding === 'number') {
    const s = String(binding);
    return s.includes('/') ? s.split('/')[0] : s;
  }
  const list = Array.isArray(binding) ? binding : [binding];
  for (const item of list) {
    if (item && typeof item === 'object') {
      const p = item.HostPort || item.hostPort || item.PublishedPort;
      if (p != null && p !== '') return String(p);
    } else if (item != null && item !== '') {
      return String(item);
    }
  }
  return '';
}

export function formatPortMapping(containerKey, binding) {
  const container = String(containerKey || '').split('/')[0] || containerKey;
  const host = publishedHostPort(binding);
  return host ? `${container} → :${host}` : String(containerKey || '');
}

export function stripDockerLogMux(text) {
  const raw = String(text || '');
  if (!raw || !/[\u0001\u0002]\u0000{3}/.test(raw)) return raw;
  return raw.replace(/[\u0001\u0002]\u0000{3}[\s\S]{4}/g, '');
}

export function resolveTaskDevice(task, hostnames, namedTunnels) {
  const named = namedTunnels || [];
  const bound = (hostnames || [])
    .map((h) => named.find((t) => t.cf_tunnel_id === h.tunnel_id || t.id === h.tunnel_id))
    .filter(Boolean);
  const stored = String(task?.worker_hostname || '').trim();
  const inferred = stored || String(bound[0]?.device_hostname || '').trim();
  const host = inferred.toLowerCase();
  const onDevice = named.filter((t) => host && String(t.device_hostname || '').toLowerCase() === host);
  const defaultTunnel = bound.find((t) => t.default_bind)
    || bound[0]
    || onDevice.find((t) => t.default_bind)
    || onDevice[0]
    || null;
  const consoleTun = named.find((t) => t.in_cloud_console && host && String(t.device_hostname || '').toLowerCase() === host);
  const deviceLabel = inferred
    ? (consoleTun ? `${consoleTun.display_name} · ${inferred}` : inferred)
    : 'unknown';
  return { host: inferred, deviceLabel, defaultTunnel, boundTunnels: bound };
}

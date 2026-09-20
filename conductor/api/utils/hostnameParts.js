'use strict';

function composeHostname(subdomain, domain) {
  const d = String(domain || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  const s = String(subdomain || '').trim().toLowerCase().replace(/^\.+|\.+$/g, '');
  if (!d || !d.includes('.')) {
    const e = new Error('domain is required (e.g. aerekos.com)');
    e.status = 400;
    throw e;
  }
  return s ? `${s}.${d}` : d;
}

function originService(port, protocol) {
  const p = String(port || '').trim();
  if (!/^\d+$/.test(p)) {
    const e = new Error('port is required');
    e.status = 400;
    throw e;
  }
  const proto = String(protocol || (p === '22' ? 'ssh' : 'http')).toLowerCase();
  if (proto !== 'http' && proto !== 'https' && proto !== 'ssh') {
    const e = new Error('protocol must be http, https, or ssh');
    e.status = 400;
    throw e;
  }
  return `${proto}://localhost:${p}`;
}

module.exports = { composeHostname, originService };

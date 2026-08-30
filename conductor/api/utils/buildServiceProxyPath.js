/**
 * Map Express path under /api/services/:serviceName/api/* to the worker HTTP path.
 * Most services mount under /api or /api/v1 on the worker.
 */
function buildServiceProxyPath(serviceName, reqPath) {
  const escaped = serviceName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = new RegExp(`^/${escaped}/api`);
  let p = reqPath.replace(prefix, '') || '/';

  if (serviceName === 'secrets_manager') {
    if (p === '/' || p === '') {
      p = '/v1/secrets';
    }
    if (!p.startsWith('/api/v1')) {
      if (p.startsWith('/v1/')) {
        p = '/api' + p;
      } else {
        p = '/api/v1' + (p.startsWith('/') ? p : `/${p}`);
      }
    }
    return p;
  }

  if (!p.startsWith('/')) {
    p = `/${p}`;
  }
  if (!p.startsWith('/api')) {
    p = `/api${p}`;
  }
  if (p === '/api/') {
    p = '/api';
  }
  if (serviceName === 'key_manager' && p === '/api') {
    p = '/api/keys';
  }
  return p;
}

module.exports = { buildServiceProxyPath };

/**
 * Paths that ServiceManager may proxy without a caller-supplied projectId.
 * Upstream managers expose unauthenticated /health and /ready; the conductor
 * still authenticates the *conductor* proxy routes that reach them
 * (authenticateService / appProxyAuth) — this flag only skips PROJECT_ID_REQUIRED.
 */
function isLivenessPath(path) {
  if (!path || typeof path !== 'string') return false;
  const bare = path.split('?')[0];
  return bare === '/health' || bare === '/ready';
}

module.exports = { isLivenessPath };

'use strict';

const { requireShared } = require('./loadWorkerShared');
const routeTemplate = requireShared('routeTemplate');

function publicApiBase() {
  return (process.env.PUBLIC_API_URL || process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');
}

function buildPrettyInvokeUrl(publicPath, params) {
  return routeTemplate.buildPublicUrl(publicApiBase(), publicPath, params);
}

function buildProxyInvokeUrl(serviceName, targetPath) {
  const base = publicApiBase();
  if (!base) return null;
  const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${base}/api/services/${serviceName}${path}`;
}

module.exports = {
  publicApiBase,
  buildPrettyInvokeUrl,
  buildProxyInvokeUrl,
};

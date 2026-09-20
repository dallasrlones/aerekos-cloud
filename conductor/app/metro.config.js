const { getDefaultConfig } = require('expo/metro-config');
const http = require('http');
const https = require('https');
const { URL } = require('url');

const config = getDefaultConfig(__dirname);

function conductorTarget() {
  const raw = process.env.CONDUCTOR_PROXY_TARGET
    || 'http://aerekos-cloud-conductor:3000';
  return String(raw).replace(/\/$/, '');
}

function shouldProxy(url) {
  const path = String(url || '').split('?')[0];
  return path === '/health'
    || path.startsWith('/api/')
    || path.startsWith('/socket.io')
    || path.startsWith('/frontend');
}

function proxy(req, res) {
  let target;
  try {
    target = new URL(conductorTarget());
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `Bad CONDUCTOR_PROXY_TARGET: ${err.message}` } }));
    return;
  }
  const lib = target.protocol === 'https:' ? https : http;
  const headers = { ...req.headers, host: target.host };
  const pReq = lib.request({
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers,
  }, (pRes) => {
    res.writeHead(pRes.statusCode || 502, pRes.headers);
    pRes.pipe(res);
  });
  pReq.on('error', (err) => {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
    }
    res.end(JSON.stringify({ error: { message: `API proxy: ${err.message}` } }));
  });
  req.pipe(pReq);
}

const previous = config.server && config.server.enhanceMiddleware;
config.server = {
  ...(config.server || {}),
  enhanceMiddleware: (middleware, server) => {
    const metro = previous ? previous(middleware, server) : middleware;
    return (req, res, next) => {
      if (shouldProxy(req.url)) return proxy(req, res);
      return metro(req, res, next);
    };
  },
};

module.exports = config;

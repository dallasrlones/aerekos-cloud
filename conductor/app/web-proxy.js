#!/usr/bin/env node
'use strict';

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const { URL } = require('url');

const PUBLIC_PORT = parseInt(process.env.PORT || '19006', 10);
const EXPO_PORT = parseInt(process.env.EXPO_INTERNAL_PORT || '19007', 10);
const TARGET = String(process.env.CONDUCTOR_PROXY_TARGET || 'http://aerekos-cloud-conductor:3000').replace(/\/$/, '');

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailers', 'transfer-encoding', 'upgrade', 'host',
]);

function outgoingHeaders(req, destHost, { stripBrowserOrigin = false, keepUpgrade = false } = {}) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    const name = String(key).toLowerCase();
    if (HOP_BY_HOP.has(name) && !(keepUpgrade && (name === 'connection' || name === 'upgrade'))) continue;
    if (stripBrowserOrigin && (name === 'origin' || name === 'referer')) continue;
    headers[key] = value;
  }
  headers.host = destHost;
  return headers;
}

function shouldApi(url) {
  const path = String(url || '').split('?')[0];
  return path === '/health'
    || path.startsWith('/api/')
    || path.startsWith('/socket.io');
}

function proxy(req, res, destBase) {
  let dest;
  try {
    dest = new URL(destBase);
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: err.message } }));
    return;
  }
  const lib = dest.protocol === 'https:' ? https : http;
  const stripBrowserOrigin = destBase.includes(`:${EXPO_PORT}`) || dest.hostname === '127.0.0.1';
  const pReq = lib.request({
    hostname: dest.hostname,
    port: dest.port || (dest.protocol === 'https:' ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: outgoingHeaders(req, dest.host, { stripBrowserOrigin }),
  }, (pRes) => {
    res.writeHead(pRes.statusCode || 502, pRes.headers);
    pRes.pipe(res);
  });
  pReq.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: `API proxy: ${err.message}` } }));
  });
  req.pipe(pReq);
}

function proxyUpgrade(req, socket, destBase) {
  let dest;
  try {
    dest = new URL(destBase);
  } catch {
    socket.destroy();
    return;
  }
  const stripBrowserOrigin = destBase.includes(`:${EXPO_PORT}`) || dest.hostname === '127.0.0.1';
  const pReq = http.request({
    hostname: dest.hostname,
    port: dest.port || 80,
    path: req.url,
    method: req.method,
    headers: outgoingHeaders(req, dest.host, { stripBrowserOrigin, keepUpgrade: true }),
  });
  pReq.on('upgrade', (pRes, pSocket) => {
    const lines = ['HTTP/1.1 101 Switching Protocols'];
    for (const [k, v] of Object.entries(pRes.headers || {})) {
      lines.push(`${k}: ${v}`);
    }
    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    pSocket.pipe(socket);
    socket.pipe(pSocket);
  });
  pReq.on('error', () => socket.destroy());
  pReq.end();
}

const server = http.createServer((req, res) => {
  if (shouldApi(req.url)) return proxy(req, res, TARGET);
  return proxy(req, res, `http://127.0.0.1:${EXPO_PORT}`);
});

server.on('upgrade', (req, socket) => {
  if (shouldApi(req.url)) return proxyUpgrade(req, socket, TARGET);
  return proxyUpgrade(req, socket, `http://127.0.0.1:${EXPO_PORT}`);
});

server.listen(PUBLIC_PORT, '0.0.0.0', () => {
  // Never `--host lan` — Expo then advertises the box LAN IP in the bundle / HMR /
  // lazy-chunk URLs. Phones (and any off-LAN client) fail with mixed-content or
  // "could not connect to 192.168.x". Public HTTPS terminates on this proxy;
  // Metro stays on localhost and clients load `/index.bundle` same-origin.
  const packagerHost = String(
    process.env.REACT_NATIVE_PACKAGER_HOSTNAME
    || process.env.EXPO_PUBLIC_WEB_ORIGIN
    || 'cloud.aerekos.com',
  ).replace(/^https?:\/\//, '').split(':')[0];
  const child = spawn('npx', ['expo', 'start', '--web', '--port', String(EXPO_PORT), '--host', 'localhost'], {
    stdio: 'inherit',
    env: {
      ...process.env,
      REACT_NATIVE_PACKAGER_HOSTNAME: packagerHost,
      EXPO_PACKAGER_PROXY_URL: process.env.EXPO_PACKAGER_PROXY_URL || 'https://cloud.aerekos.com',
    },
  });
  child.on('exit', (code) => process.exit(code || 0));
});

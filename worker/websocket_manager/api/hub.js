'use strict';

const { WebSocketServer } = require('ws');

/**
 * In-process channel hub. HTTP publish and WSS subscribers share this map.
 * Multi-instance fan-out uses POST /internal/deliver on each replica.
 */
class ChannelHub {
  constructor() {
    this.channels = new Map(); // `${projectId}:${name}` -> Set<ws>
  }

  key(projectId, name) {
    return `${projectId || '*'}::${name}`;
  }

  subscribe(projectId, name, ws) {
    const k = this.key(projectId, name);
    if (!this.channels.has(k)) this.channels.set(k, new Set());
    this.channels.get(k).add(ws);
    ws.on('close', () => this.unsubscribe(projectId, name, ws));
  }

  unsubscribe(projectId, name, ws) {
    const set = this.channels.get(this.key(projectId, name));
    if (set) set.delete(ws);
  }

  publish(projectId, name, payload) {
    const msg = JSON.stringify({
      channel: name,
      project_id: projectId,
      payload,
      ts: new Date().toISOString(),
    });
    const set = this.channels.get(this.key(projectId, name)) || new Set();
    let n = 0;
    for (const ws of set) {
      if (ws.readyState === 1) {
        ws.send(msg);
        n += 1;
      }
    }
    return { delivered: n, channel: name };
  }

  attach(server) {
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws, req) => {
      try {
        const host = req.headers.host || 'localhost';
        const url = new URL(req.url || '/ws', `http://${host}`);
        const channel = url.searchParams.get('channel') || 'app';
        const projectId = url.searchParams.get('project_id') || '';
        this.subscribe(projectId, channel, ws);
        ws.send(JSON.stringify({ type: 'subscribed', channel, project_id: projectId }));
      } catch (err) {
        ws.close();
      }
    });
    this.wss = wss;
    return wss;
  }
}

const hub = new ChannelHub();
module.exports = { ChannelHub, hub };

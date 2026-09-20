'use strict';

/**
 * Playwright sidecar client + in-process fallback for tests.
 * Live: HTTP to aerekos-icarus-browser on the Computer worker.
 * Frames stored on disk, never stuffed into SQLite.
 */

const fs = require('fs');
const path = require('path');
const { fail } = require('./agentArn');

const FRAME_CAP = 20;
const sessions = new Map();
const frames = new Map();
const consoles = new Map();
const CONSOLE_CAP = 40;

function keyOf(projectId, agentId) {
  return `${projectId}:${agentId}`;
}

function frameDir() {
  return process.env.ICARUS_BROWSER_FRAMES || path.join(__dirname, '../../data/browser-frames');
}

function listFrames(projectId, agentId) {
  const k = keyOf(projectId, agentId);
  return frames.get(k) || [];
}

function putFrame(projectId, agentId, buf, meta = {}) {
  const k = keyOf(projectId, agentId);
  const id = `fr-${Date.now().toString(36)}`;
  const dir = path.join(frameDir(), String(projectId || 'x'), String(agentId || 'x'));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${id}.jpg`);
  fs.writeFileSync(file, buf);
  const row = { id, path: file, url: meta.url || '', title: meta.title || '', at: new Date().toISOString() };
  const cur = listFrames(projectId, agentId);
  cur.push(row);
  while (cur.length > FRAME_CAP) {
    const drop = cur.shift();
    try { fs.unlinkSync(drop.path); } catch { /* */ }
  }
  frames.set(k, cur);
  return row;
}

function getFrame(projectId, agentId, frameId) {
  const row = listFrames(projectId, agentId).find((f) => f.id === frameId);
  if (!row) return null;
  try {
    return { ...row, bytes: fs.readFileSync(row.path) };
  } catch {
    return row;
  }
}

function putConsole(projectId, agentId, events = []) {
  const k = keyOf(projectId, agentId);
  const cur = consoles.get(k) || [];
  for (const ev of [].concat(events || [])) {
    cur.push({
      type: String(ev?.type || 'log'),
      text: String(ev?.text || '').slice(0, 500),
      url: String(ev?.url || ''),
      at: ev?.at || Date.now(),
    });
  }
  while (cur.length > CONSOLE_CAP) cur.shift();
  consoles.set(k, cur);
  return cur;
}

function listConsole(projectId, agentId) {
  return consoles.get(keyOf(projectId, agentId)) || [];
}

function sessionOf(projectId, agentId) {
  return sessions.get(keyOf(projectId, agentId)) || null;
}

function wipe(projectId, agentId) {
  const k = keyOf(projectId, agentId);
  sessions.delete(k);
  consoles.delete(k);
  const cur = frames.get(k) || [];
  for (const f of cur) {
    try { fs.unlinkSync(f.path); } catch { /* */ }
  }
  frames.delete(k);
  return { wiped: true };
}

async function callSidecar(settings, body) {
  const base = settings.browser_url || process.env.ICARUS_BROWSER_URL || '';
  if (!base) return null;
  const res = await fetch(`${String(base).replace(/\/$/, '')}/act`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(json.error || `browser HTTP ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return json;
}

function fakeSnapshot(url) {
  return {
    url,
    title: url,
    snapshot: [{ role: 'document', name: url, children: [{ role: 'link', name: 'Example' }] }],
  };
}

async function act(projectId, agentId, { name, args = {}, settings = {}, owner } = {}) {
  const n = String(name || '').replace(/^browser_/, '');
  if (/pay|auth|captcha|password|login|checkout/i.test(JSON.stringify(args))) {
    return { ok: false, hitl: true, error: 'browser HITL — takeover required' };
  }
  let sess = sessionOf(projectId, agentId);
  if (sess && owner && sess.owner && sess.owner !== owner) {
    return { ok: false, error: 'another worker owns the browser session' };
  }
  const payload = {
    project_id: projectId,
    agent_id: agentId,
    action: n,
    url: args.url,
    selector: args.selector || args.text,
    value: args.value || args.text,
    key: args.key,
  };
  let result;
  try {
    result = await callSidecar(settings, payload);
  } catch (e) {
    if (settings.browser_url || process.env.ICARUS_BROWSER_URL) {
      return { ok: false, browser_down: true, error: e.message };
    }
    result = null;
  }
  if (!result) {
    if (n === 'navigate') {
      sess = { owner: owner || '', url: args.url || 'about:blank', title: args.url || '' };
      sessions.set(keyOf(projectId, agentId), sess);
      result = fakeSnapshot(sess.url);
    } else if (!sess) {
      return { ok: false, browser_down: true, error: 'no browser session' };
    } else if (n === 'snapshot') {
      result = fakeSnapshot(sess.url);
    } else {
      result = fakeSnapshot(sess.url);
    }
  }
  const url = result.url || sess?.url || args.url || '';
  const title = result.title || url;
  sessions.set(keyOf(projectId, agentId), { owner: owner || sess?.owner || '', url, title });
  const consoleEvents = result.console || [];
  if (consoleEvents.length) putConsole(projectId, agentId, consoleEvents);
  let frame = null;
  if (n === 'navigate' || n === 'screenshot' || n === 'click' || n === 'type' || n === 'press' || n === 'select') {
    const jpeg = result.screenshot_base64
      ? Buffer.from(result.screenshot_base64, 'base64')
      : Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wAAA//Z', 'base64');
    frame = putFrame(projectId, agentId, jpeg, { url, title });
  }
  return {
    ok: true,
    url,
    title,
    snapshot: result.snapshot || fakeSnapshot(url).snapshot,
    frame_id: frame?.id || null,
    hitl: false,
    console: listConsole(projectId, agentId).slice(-20),
  };
}

function requireFrame(projectId, agentId, frameId) {
  const row = getFrame(projectId, agentId, frameId);
  if (!row) throw fail(404, 'frame not found');
  return row;
}

module.exports = {
  FRAME_CAP, act, wipe, getFrame, listFrames, sessionOf, requireFrame, putFrame,
  putConsole, listConsole, CONSOLE_CAP,
};

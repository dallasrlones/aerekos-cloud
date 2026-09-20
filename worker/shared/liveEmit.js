'use strict';

/**
 * Best-effort push to conductor /api/live (frontend socket rooms).
 * Managers call this instead of making the console HTTP-poll.
 */
async function liveEmit(room, event, data) {
  const base = String(process.env.CONDUCTOR_URL || process.env.CONDUCTOR_INTERNAL_BASE_URL || '').replace(/\/$/, '');
  if (!base) return false;
  const token = process.env.CONDUCTOR_TOKEN
    || process.env.SERVICE_TOKEN
    || process.env.WORKER_TOKEN
    || process.env.WORKER_REGISTRATION_TOKEN
    || '';
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 2000);
    const res = await fetch(`${base}/api/live`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ room, event, data: data || {} }),
      signal: ac.signal,
    });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

function liveEmitSoon(room, event, data) {
  void liveEmit(room, event, data);
}

module.exports = { liveEmit, liveEmitSoon };

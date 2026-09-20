'use strict';

function fieldHit(field, value) {
  const f = String(field || '*').trim();
  if (f === '*') return true;
  if (f.includes(',')) return f.split(',').some((p) => fieldHit(p, value));
  if (f.includes('/')) {
    const [base, stepRaw] = f.split('/');
    const step = Number(stepRaw) || 1;
    if (base === '*') return value % step === 0;
    const n = Number(base);
    return Number.isFinite(n) && value >= n && ((value - n) % step === 0);
  }
  if (f.includes('-')) {
    const [a, b] = f.split('-').map(Number);
    return value >= a && value <= b;
  }
  return Number(f) === value;
}

function partsInZone(date, tz) {
  const d = date instanceof Date ? date : new Date(date);
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz || 'America/Los_Angeles',
    minute: 'numeric',
    hour: 'numeric',
    day: 'numeric',
    month: 'numeric',
    weekday: 'short',
    hourCycle: 'h23',
  });
  const bag = {};
  for (const p of fmt.formatToParts(d)) {
    if (p.type !== 'literal') bag[p.type] = p.value;
  }
  const weekMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    minute: Number(bag.minute),
    hour: Number(bag.hour),
    day: Number(bag.day),
    month: Number(bag.month),
    weekday: weekMap[bag.weekday] ?? d.getDay(),
  };
}

function cronMatches(expr, date, tz) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length < 5) return false;
  const p = partsInZone(date, tz);
  return fieldHit(parts[0], p.minute)
    && fieldHit(parts[1], p.hour)
    && fieldHit(parts[2], p.day)
    && fieldHit(parts[3], p.month)
    && fieldHit(parts[4], p.weekday);
}

function periodMs(expr) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts[0] !== '0' && parts[0] !== '*') return 60 * 60 * 1000;
  if (parts[1] === '*') return 60 * 60 * 1000;
  if (parts[2] === '*' && parts[4] === '*') return 24 * 60 * 60 * 1000;
  if (parts[4] !== '*') return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

function isNetError(err) {
  const t = String(err?.code || err?.message || err || '');
  return /enotfound|econnrefused|etimedout|enetunreach|eai_again|network|offline|dns|fetch failed|socket|timed out/i.test(t);
}

function dueCron(row, now = new Date(), { catchup = false } = {}) {
  if (!row || row.enabled === 'false' || row.enabled === false) return { due: false };
  const ts = now instanceof Date ? now.getTime() : Number(now);
  const tz = row.timezone || 'America/Los_Angeles';
  const kind = row.kind || (row.run_at ? 'once' : 'recurring');
  if (kind === 'once' || row.run_at) {
    const at = Date.parse(row.run_at || '');
    if (!Number.isFinite(at) || row.last_fired_at) return { due: false };
    if (ts < at) return { due: false };
    const late = ts - at > 15 * 60 * 1000;
    return { due: true, late, label: late ? 'I was down.' : '' };
  }
  const last = row.last_fired_at ? Date.parse(row.last_fired_at) : 0;
  if (cronMatches(row.schedule, ts, tz) && (!last || ts - last > 55 * 1000)) {
    return { due: true, late: false, label: '' };
  }
  if (catchup) {
    const period = periodMs(row.schedule);
    const missed = !last || (ts - last > period + 60 * 1000);
    if (missed && last && ts - last < period * 2.5) {
      return { due: true, late: true, label: 'I was down.' };
    }
    if (missed && !last && row.created_at && ts - Date.parse(row.created_at) > period) {
      return { due: true, late: true, label: 'I was down.' };
    }
  }
  return { due: false };
}

function parseCronIntent(text, now = new Date(), tz = 'America/Los_Angeles') {
  const t = String(text || '').trim();
  if (!t) return null;
  const weather = /\bweather\b/i.test(t);
  const remind = /\bremind\b/i.test(t);
  let objective = t.replace(/^(every|each|in an hour|tomorrow|at \d).+?(to |and )?/i, '').trim() || t;
  if (weather) objective = 'check the weather';
  const everyMorning = /\bevery morning\b/i.test(t) || /\bevery day at\b/i.test(t);
  const atHour = t.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (everyMorning || (/\bevery day\b/i.test(t) && atHour)) {
    let hour = atHour ? Number(atHour[1]) : 7;
    const min = atHour && atHour[2] ? Number(atHour[2]) : 0;
    const ap = (atHour && atHour[3] || (everyMorning && !atHour ? 'am' : '')).toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    return {
      kind: 'recurring',
      schedule: `${min} ${hour} * * *`,
      timezone: tz,
      name: weather ? 'morning-weather' : 'daily',
      handoff: { kind: 'user_turn', objective },
      speak: weather
        ? `Every day at ${hour}:${String(min).padStart(2, '0')} I'll check the weather. Sound good?`
        : `Every day at ${hour}:${String(min).padStart(2, '0')} I'll ${objective}. Sound good?`,
    };
  }
  if (/\bin an hour\b/i.test(t)) {
    const at = new Date(now.getTime() + 60 * 60 * 1000);
    return {
      kind: 'once',
      run_at: at.toISOString(),
      timezone: tz,
      name: 'in-an-hour',
      handoff: { kind: 'user_turn', objective: objective || t },
      speak: `In an hour I'll ${objective || 'nudge you'}. Sound good?`,
    };
  }
  const tom = t.match(/\btomorrow at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (tom || (/\btomorrow\b/i.test(t) && atHour)) {
    const m = tom || atHour;
    let hour = Number(m[1]);
    const min = m[2] ? Number(m[2]) : 0;
    const ap = (m[3] || '').toLowerCase();
    if (ap === 'pm' && hour < 12) hour += 12;
    if (ap === 'am' && hour === 12) hour = 0;
    const base = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const run = new Date(base);
    run.setHours(hour, min, 0, 0);
    return {
      kind: 'once',
      run_at: run.toISOString(),
      timezone: tz,
      name: remind ? 'reminder' : 'tomorrow',
      handoff: { kind: 'user_turn', objective: objective || t },
      speak: `Tomorrow at ${hour}:${String(min).padStart(2, '0')} I'll ${objective || 'nudge you'}. Sound good?`,
    };
  }
  if (/\bevery\b.+\bat\b/i.test(t) || /\bcron\b/i.test(t)) {
    return {
      kind: 'recurring',
      schedule: '0 9 * * *',
      timezone: tz,
      name: 'routine',
      handoff: { kind: 'user_turn', objective },
      speak: `I'll set a daily routine for: ${objective}. Sound good?`,
    };
  }
  return null;
}

module.exports = {
  fieldHit, partsInZone, cronMatches, periodMs, isNetError, dueCron, parseCronIntent,
};

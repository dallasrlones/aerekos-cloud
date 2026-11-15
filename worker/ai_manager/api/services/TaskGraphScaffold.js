'use strict';

function percentDone(tasks) {
  const list = Array.isArray(tasks) ? tasks : [];
  if (!list.length) return 0;
  const done = list.filter((t) => String(t.status || '').toLowerCase() === 'done').length;
  return Math.round((done / list.length) * 100);
}

module.exports = { percentDone };


'use strict';

function mergeContext(parts) {
  return (Array.isArray(parts) ? parts : [])
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .join('\n\n');
}

module.exports = { mergeContext };

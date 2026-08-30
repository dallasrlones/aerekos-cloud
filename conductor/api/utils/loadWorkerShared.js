'use strict';

const path = require('path');

/**
 * Load worker/shared modules from monorepo layout or conductor image (worker-shared/).
 */
function requireShared(mod) {
  const candidates = [
    path.join(__dirname, '../../../worker/shared', mod),
    path.join(__dirname, '../../worker-shared', mod),
  ];
  for (const p of candidates) {
    try {
      return require(p);
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') throw err;
    }
  }
  throw new Error(`worker shared module not found: ${mod}`);
}

module.exports = { requireShared };

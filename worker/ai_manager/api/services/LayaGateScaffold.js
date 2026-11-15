'use strict';

function assertLayaGate(result, { name = 'laya' } = {}) {
  if (!result || result.ok !== true) {
    const err = new Error(`${name}_gate_failed`);
    err.code = 'LAYA_GATE_FAILED';
    err.detail = result || null;
    throw err;
  }
  return true;
}

module.exports = { assertLayaGate };


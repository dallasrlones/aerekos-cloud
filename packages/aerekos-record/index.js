'use strict';

function createRecordClient(options = {}) {
  return {
    dialect: options.dialect || 'sqlite',
    async ping() { return { ok: true, scaffold: true }; },
  };
}

module.exports = { createRecordClient };

'use strict';

/**
 * Thin store seam. This pass: SqliteStore (DATABASE_PATH).
 * Edition 2 can add PostgresStore without rewriting routes.
 */
const path = require('path');

class SqliteStore {
  constructor(opts = {}) {
    this.databasePath = opts.databasePath || process.env.DATABASE_PATH || path.join(__dirname, '../../data/conductor.db');
  }

  path() {
    return this.databasePath;
  }

  async init() {
    const { initializeDatabase } = require('../utils/dbInit');
    return initializeDatabase();
  }
}

function createConductorStore() {
  const kind = String(process.env.CONDUCTOR_STORE || 'sqlite').toLowerCase();
  if (kind !== 'sqlite') {
    throw new Error(`CONDUCTOR_STORE=${kind} is not implemented this pass (use sqlite)`);
  }
  return new SqliteStore();
}

module.exports = { SqliteStore, createConductorStore };

'use strict';

const Record = require('aerekos-record');
const { normalizeEngine } = require('./dataSchema');

const localDb = require('../utils/dbClient');

/** Engines aerekos-record can query. Others fall back to sqlite3. */
const RECORD_TYPES = {
  sqlite3: 'sqlite',
  sqlite: 'sqlite',
  postgresql: 'postgresql',
  postgres: 'postgresql',
  mysql: 'postgresql',
  mongodb: 'mongodb',
  mongo: 'mongodb',
  neo4j: 'neo4j',
  elasticsearch: 'elasticsearch',
  redis: 'redis',
};

const DB_MANAGER_TYPES = ['postgresql', 'mongodb', 'neo4j', 'elasticsearch', 'redis', 'sqlite3', 'lancedb'];

const recordCache = new Map();

function provisionType(engine) {
  const e = normalizeEngine(engine);
  if (e === 'mysql') return 'postgresql';
  return DB_MANAGER_TYPES.includes(e) ? e : 'sqlite3';
}

function recordType(engine) {
  const e = normalizeEngine(engine);
  return RECORD_TYPES[e] || null;
}

function connectionSettings(engine, info = {}) {
  const e = normalizeEngine(engine);
  const host = info.host || '127.0.0.1';
  const port = info.port;
  const user = info.username || info.user;
  const password = info.password;
  const database = info.database || info.name;
  const url = info.connection_string;

  if (e === 'postgresql' || e === 'mysql') {
    if (url) return { connectionString: url };
    return { host, port, user, password, database };
  }
  if (e === 'mongodb') {
    return { uri: url || `mongodb://${user}:${encodeURIComponent(password || '')}@${host}:${port}`, database };
  }
  if (e === 'neo4j') {
    return { uri: url || `neo4j://${host}:${port}`, user, password, database };
  }
  if (e === 'elasticsearch') {
    return {
      node: url || `http://${host}:${port}`,
      auth: user ? { username: user, password } : undefined,
    };
  }
  if (e === 'redis') {
    if (url) return { url };
    return { socket: { host, port: Number(port) || 6379 }, password };
  }
  return null;
}

function localSqlite() {
  return { db: localDb, engine: 'sqlite3', adapter: 'sqlite', fallback: false };
}

function connectRemote(engine, info) {
  const type = recordType(engine);
  if (!type || type === 'sqlite') return localSqlite();
  const settings = connectionSettings(engine, info);
  if (!settings) return localSqlite();
  const db = Record.connect(type, settings);
  return { db, engine: normalizeEngine(engine), adapter: type, fallback: false };
}

function cacheKey(projectId, schema) {
  return `${projectId}:${schema.name}:${schema.engine}:${schema.database}`;
}

function getCached(projectId, schema) {
  return recordCache.get(cacheKey(projectId, schema)) || null;
}

function setCached(projectId, schema, conn) {
  recordCache.set(cacheKey(projectId, schema), conn);
  return conn;
}

/**
 * Settings passed to aerekos-record. Association arrays are stripped so sqlite
 * ensureTable does not emit duplicate FK columns (belongsTo + injected user_id).
 */
function recordModelSettings(def) {
  const settings = { ...(def.settings || {}) };
  delete settings.belongsTo;
  delete settings.hasMany;
  delete settings.hasOne;
  delete settings.compound_indexes;
  return settings;
}

module.exports = {
  provisionType,
  recordType,
  connectionSettings,
  localSqlite,
  connectRemote,
  getCached,
  setCached,
  cacheKey,
  recordModelSettings,
  RECORD_TYPES,
  DB_MANAGER_TYPES,
};

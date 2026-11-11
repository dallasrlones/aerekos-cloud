'use strict';

let driver = null;

function getConfig() {
  return {
    uri: process.env.NEO4J_URI || process.env.ICARUS_NEO4J_URI || '',
    user: process.env.NEO4J_USER || process.env.ICARUS_NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || process.env.ICARUS_NEO4J_PASSWORD || '',
    database: process.env.NEO4J_DATABASE || process.env.ICARUS_NEO4J_DATABASE || 'neo4j',
  };
}

function isConfigured() {
  return Boolean(getConfig().uri);
}

async function getDriver() {
  if (driver) return driver;
  const cfg = getConfig();
  if (!cfg.uri) {
    const err = new Error('NEO4J_URI not set — plan graph requires Neo4j');
    err.code = 'NEO4J_NOT_CONFIGURED';
    throw err;
  }
  // eslint-disable-next-line import/no-extraneous-dependencies, global-require
  const neo4j = require('neo4j-driver');
  driver = neo4j.driver(cfg.uri, neo4j.auth.basic(cfg.user, cfg.password), {
    disableLosslessIntegers: true,
  });
  return driver;
}

async function withSession(work) {
  const d = await getDriver();
  const cfg = getConfig();
  const session = d.session({ database: cfg.database });
  try {
    return await work(session);
  } finally {
    await session.close();
  }
}

async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}

module.exports = {
  getConfig, isConfigured, getDriver, withSession, closeDriver,
};

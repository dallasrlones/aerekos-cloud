/**
 * Simple logger utility for db_manager
 * Uses console for now, can be replaced with winston later
 */
const logger = {
  info: (...args) => {
    console.log('[db_manager]', ...args);
  },
  warn: (...args) => {
    console.warn('[db_manager]', ...args);
  },
  error: (...args) => {
    console.error('[db_manager]', ...args);
  },
  debug: (...args) => {
    if (process.env.DEBUG === 'true') {
      console.debug('[db_manager]', ...args);
    }
  }
};

module.exports = logger;


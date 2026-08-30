const path = require('path');
const { LogOutbox } = require('../shared/logOutbox/LogOutbox');
const { LogShipper } = require('../shared/logOutbox/LogShipper');

let shipper = null;
let outbox = null;

/**
 * Durable log buffer + background flush to conductor → logs_manager (when online).
 * Opt-in: set LOG_SPOOL=1, LOG_SHIP_BEARER (user JWT or service token the proxy accepts), LOG_SHIP_PROJECT_ID.
 *
 * @returns {{ stop: () => void, enqueue: (e: object) => void, pendingCount: () => number } | null}
 */
function startLogShipping() {
  const enabled = process.env.LOG_SPOOL === '1' || process.env.LOG_SPOOL === 'true';
  if (!enabled) {
    return null;
  }
  const base = process.env.CONDUCTOR_URL;
  if (!base) {
    console.warn('[logOutbox] LOG_SPOOL on but CONDUCTOR_URL missing; skipping shipper');
    return null;
  }
  const bearer = process.env.LOG_SHIP_BEARER || process.env.AEREKOS_LOG_BEARER;
  if (!bearer) {
    console.warn(
      '[logOutbox] LOG_SPOOL on but no LOG_SHIP_BEARER (or AEREKOS_LOG_BEARER); shipper not started. Set a JWT or service token for /api/services/logs_manager proxy.'
    );
    return null;
  }
  const projectId = process.env.LOG_SHIP_PROJECT_ID;
  if (!projectId) {
    console.warn('[logOutbox] LOG_SPOOL on but LOG_SHIP_PROJECT_ID missing; shipper not started');
    return null;
  }

  const dbPath = process.env.LOG_OUTBOX_PATH || path.join(__dirname, '..', 'data', 'worker_log_outbox.db');
  outbox = new LogOutbox(dbPath);
  outbox.open();

  const interval = parseInt(process.env.LOG_SHIP_INTERVAL_MS || '5000', 10);
  shipper = new LogShipper({
    outbox,
    conductorBaseUrl: base,
    bearerToken: bearer,
    intervalMs: Number.isFinite(interval) && interval > 0 ? interval : 5000,
    batchSize: Math.min(200, parseInt(process.env.LOG_SHIP_BATCH || '80', 10) || 80)
  });
  shipper.start();
  // Best-effort immediate flush
  setImmediate(() => {
    shipper.flushOnce().catch(() => {});
  });
  console.log(
    `[logOutbox] shipper started → ${path.basename(dbPath)} (project ${String(projectId).slice(0, 8)}…)`
  );

  return {
    stop() {
      if (shipper) {
        shipper.stop();
        shipper = null;
      }
      if (outbox) {
        outbox.close();
        outbox = null;
      }
    },
    /** Enqueue a line for a project (defaults to LOG_SHIP_PROJECT_ID). */
    enqueue(entry) {
      const o = outbox;
      if (!o) {
        return;
      }
      o.enqueue({
        projectId: entry.projectId || projectId,
        level: entry.level || 'info',
        message: entry.message || '',
        source: entry.source || 'worker_agent',
        context: entry.context
      });
    },
    pendingCount() {
      return outbox ? outbox.pendingCount() : 0;
    }
  };
}

module.exports = { startLogShipping };

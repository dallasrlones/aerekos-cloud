const { MemoryPromoteService } = require('./MemoryPromoteService');
const { MemoryStoreService } = require('./MemoryStoreService');
const { getMemoryDbClient } = require('./MemoryDbClient');

const DEFAULT_INTERVAL_MS = 15 * 60 * 1000;

function startMemorySummarizeWorker(opts = {}) {
  const intervalMs = Number(process.env.MEMORY_PROMOTE_INTERVAL_MS) || opts.intervalMs || DEFAULT_INTERVAL_MS;
  if (process.env.MEMORY_PROMOTE_WORKER === '0') return () => {};

  const db = getMemoryDbClient();
  const storeService = new MemoryStoreService(db);
  const promote = new MemoryPromoteService({ dbClient: db, storeService });

  const tick = async () => {
    try {
      const configs = await storeService.listReadyConfigs?.() || [];
      const list = configs.length ? configs : [];
      if (!list.length && process.env.MEMORY_DB_FALLBACK === '1') {
        /* fallback mode: no global config list — skip background sweep */
        return;
      }
      for (const row of list) {
        const pid = row.project_id;
        if (!pid) continue;
        const result = await promote.promote(pid, {});
        if (result.promoted > 0) {
          console.log(`[MemorySummarizeWorker] project=${pid} promoted=${result.promoted}`);
        }
      }
    } catch (err) {
      console.warn('[MemorySummarizeWorker]', err.message);
    }
  };

  const timer = setInterval(() => { void tick(); }, intervalMs);
  void tick();
  return () => clearInterval(timer);
}

module.exports = { startMemorySummarizeWorker };

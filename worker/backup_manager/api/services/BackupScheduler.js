'use strict';

function cronMatch(expr, date = new Date()) {
  const parts = String(expr || '').trim().split(/\s+/);
  if (parts.length < 5) return false;
  const [min, hour] = parts;
  const ok = (field, value) => field === '*' || String(Number(field)) === String(value);
  return ok(min, date.getUTCMinutes()) && ok(hour, date.getUTCHours());
}

class BackupScheduler {
  constructor({ jobService, itemService } = {}) {
    this.jobService = jobService;
    this.itemService = itemService;
    this.lastKey = '';
  }

  async tick() {
    if (!this.itemService || !this.jobService) return;
    const now = new Date();
    const key = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}-${now.getUTCMinutes()}`;
    if (key === this.lastKey) return;
    const { Item } = require('../models');
    const vaults = await Item.findAll();
    const due = (Array.isArray(vaults) ? vaults : []).filter((v) => cronMatch(v.schedule || '0 2 * * *', now));
    if (!due.length) return;
    this.lastKey = key;
    for (const vault of due) {
      const pid = vault.project_id;
      const sources = String(vault.targets || 'storage,git').split(',').map((s) => s.trim()).filter(Boolean);
      for (const source of sources) {
        try {
          await this.jobService.create({
            project_id: pid,
            source,
            resource: 'default',
            vault: vault.name || 'default',
          });
        } catch (e) {
          console.warn('[backup_manager] scheduled job failed:', source, e.message);
        }
      }
    }
  }

  start() {
    this._t = setInterval(() => this.tick().catch((e) => console.warn('[backup_manager] tick:', e.message)), 60000);
    return this;
  }
}

module.exports = { BackupScheduler, cronMatch };

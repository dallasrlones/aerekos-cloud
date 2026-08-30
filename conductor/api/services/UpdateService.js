/**
 * UpdateService — decides whether a device should update, and tracks one-shot
 * "Update now" requests from the dashboard.
 *
 * Two ways a device gets told to update (matching the chosen "auto + manual" model):
 *   • auto   — the device isn't on the latest published release (default ON,
 *              toggle with AUTO_UPDATE=false)
 *   • forced — an admin clicked "Update now" for that device; consumed once.
 *
 * Forced requests are kept in memory (keyed by device hostname). They're
 * inherently transient — if the conductor restarts, auto-update still converges
 * everything to the latest release.
 */
const ReleaseService = require('./ReleaseService');

const AUTO_UPDATE = String(process.env.AUTO_UPDATE ?? 'true').toLowerCase() !== 'false';

class UpdateService {
  constructor() {
    this.forced = new Set();
    this.paused = new Set();
    this.pins = new Map();
    this.window = process.env.UPDATE_WINDOW || '02:00-06:00';
  }

  pin(hostname, version) {
    if (hostname && version) this.pins.set(hostname, version);
    return { pinned: true, hostname, version };
  }

  unpin(hostname) {
    if (hostname) this.pins.delete(hostname);
    return { pinned: false, hostname };
  }

  pinnedVersion(hostname) {
    return this.pins.get(hostname) || null;
  }

  /** Dashboard "Update now" for a device. */
  requestUpdate(hostname) {
    if (hostname) this.forced.add(hostname);
  }

  async requestUpdateAll() {
    const WorkerRepository = require('../repos/WorkerRepository');
    const workers = await WorkerRepository.findAll();
    const hostnames = [];
    for (const w of workers || []) {
      if (w.hostname) {
        this.requestUpdate(w.hostname);
        hostnames.push(w.hostname);
      }
    }
    return { nudged: hostnames.length, hostnames };
  }

  pause(hostname) {
    if (hostname) this.paused.add(hostname);
    else this.paused.add('*');
  }

  resume(hostname) {
    if (hostname) this.paused.delete(hostname);
    else this.paused.delete('*');
  }

  isPaused(hostname) {
    return this.paused.has('*') || (hostname && this.paused.has(hostname));
  }

  isForced(hostname) {
    return !!hostname && this.forced.has(hostname);
  }

  peek(hostname, currentVersion) {
    return this._decide(hostname, currentVersion, { consume: false });
  }

  /**
   * Decide what (if anything) a polling device should do.
   */
  decide(hostname, currentVersion) {
    return this._decide(hostname, currentVersion, { consume: true });
  }

  _decide(hostname, currentVersion, { consume }) {
    const latest = ReleaseService.getLatest();
    const pinned = this.pinnedVersion(hostname);
    if (pinned) {
      return { update: currentVersion !== pinned, version: pinned, sha256: null, reason: 'pinned' };
    }
    if (!latest) {
      return { update: false, version: null, sha256: null, reason: 'no-releases' };
    }
    if (this.isPaused(hostname)) {
      return { update: false, version: latest.version, sha256: latest.sha256, reason: 'paused' };
    }

    const forced = this.isForced(hostname);
    const behind = currentVersion !== latest.version;

    if (forced) {
      if (consume) this.forced.delete(hostname);
      return { update: true, version: latest.version, sha256: latest.sha256, reason: 'requested' };
    }
    if (AUTO_UPDATE && behind) {
      return { update: true, version: latest.version, sha256: latest.sha256, reason: 'auto' };
    }
    return { update: false, version: latest.version, sha256: latest.sha256, reason: behind ? 'behind-auto-off' : 'up-to-date' };
  }
}

module.exports = new UpdateService();

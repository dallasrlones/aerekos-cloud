'use strict';

/**
 * Minimal qBittorrent WebAPI v2 client (no external deps — axios + a manual
 * SID cookie). Used by download_manager to drive real torrent downloads.
 *
 * Endpoints (https://github.com/qBittorrent/qBittorrent/wiki/WebUI-API):
 *   POST /api/v2/auth/login            (form: username, password) -> SID cookie
 *   POST /api/v2/torrents/add          (form: urls, savepath, ...) -> infohash
 *   GET  /api/v2/torrents/info         (?hashes=h1|h2) -> [torrent]
 *   GET  /api/v2/torrents/files        (?hashes=h) -> [{name, path, size}]
 *   POST /api/v2/torrents/resume       (form: hashes)
 *   POST /api/v2/torrents/delete       (form: hashes, deleteFiles)
 *   GET  /api/v2/search/start          (?query=&category=) -> searchId
 *   GET  /api/v2/search/status         (?id=) -> {status, progress}
 *   GET  /api/v2/search/results        (?id=) -> [{fileName, size, siteName,...}]
 */

const axios = require('axios');
const Q = require('querystring');

const isHash = (s) => typeof s === 'string' && /^[a-f0-9]{40}$/i.test(s.trim());

class QbitClient {
  constructor({ url, user = 'admin', pass = '', timeout = 20000 } = {}) {
    this.url = String(url || '').replace(/\/$/, '');
    this.user = user;
    this.pass = pass;
    this.timeout = timeout;
    this.sid = null;
  }

  get configured() {
    return !!this.url;
  }

  _base() {
    if (!this.url) throw new Error('qBittorrent URL not configured (QBITTORRENT_URL)');
    return this.url;
  }

  _headers() {
    const h = {};
    if (this.sid) h.Cookie = `SID=${this.sid}`;
    return h;
  }

  /** Login and cache the SID cookie. Safe to call repeatedly (idempotent). */
  async login() {
    if (this.sid) return true;
    const res = await axios.post(
      `${this._base()}/api/v2/auth/login`,
      Q.stringify({ username: this.user, password: this.pass }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: this.timeout,
        validateStatus: () => true,
      },
    );
    const setCookie = res.headers['set-cookie'] || [];
    const raw = Array.isArray(setCookie) ? setCookie.join('; ') : String(setCookie);
    const m = raw.match(/SID=([^;]+)/);
    if (res.status === 200 && m) {
      this.sid = m[1];
      return true;
    }
    if (res.status === 403) throw new Error('qBittorrent auth failed (403) — check QBITTORRENT_USER/PASS');
    if (res.status === 200) {
      // Some builds return 200 without a fresh cookie; treat as already logged in.
      this.sid = this.sid || 'anonymous';
      return true;
    }
    throw new Error(`qBittorrent login failed (HTTP ${res.status})`);
  }

  async _form(path, fields, timeout = this.timeout) {
    const res = await axios.post(
      `${this._base()}/api/v2${path}`,
      Q.stringify(fields),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...this._headers() },
        timeout,
        validateStatus: () => true,
      },
    );
    if (res.status === 403) {
      // SID expired — re-login once and retry.
      this.sid = null;
      await this.login();
      return this._form(path, fields, timeout);
    }
    if (res.status >= 400) {
      throw new Error(`qBittorrent ${path} failed (HTTP ${res.status}): ${typeof res.data === 'string' ? res.data : JSON.stringify(res.data)}`.slice(0, 300));
    }
    return res.data;
  }

  async _get(path, params = {}, timeout = this.timeout) {
    const res = await axios.get(`${this._base()}/api/v2${path}`, {
      params,
      headers: this._headers(),
      timeout,
      validateStatus: () => true,
    });
    if (res.status === 403) {
      this.sid = null;
      await this.login();
      return this._get(path, params, timeout);
    }
    if (res.status >= 400) {
      throw new Error(`qBittorrent GET ${path} failed (HTTP ${res.status})`);
    }
    return res.data;
  }

  /**
   * Add a torrent from a magnet link or a .torrent URL.
   * @returns {Promise<string>} the infohash of the added torrent (best effort).
   */
  async addTorrent({ urls, savepath, paused = false, label = '' }) {
    const fields = { urls: String(urls), paused: paused ? '1' : '0' };
    if (savepath) fields.savepath = savepath;
    if (label) fields.label = label;
    const out = await this._form('/torrents/add', fields);
    const hash = typeof out === 'string' ? out.trim() : '';
    return isHash(hash) ? hash.toLowerCase() : '';
  }

  /** Get info for one or more hashes. */
  async info(hashes) {
    const list = (Array.isArray(hashes) ? hashes : [hashes]).filter(Boolean).join('|');
    if (!list) return [];
    return (await this._get('/torrents/info', { hashes: list })) || [];
  }

  /** List files for a single torrent. */
  async files(hash) {
    return (await this._get('/torrents/files', { hashes: String(hash) })) || [];
  }

  async resume(hashes) {
    const list = (Array.isArray(hashes) ? hashes : [hashes]).filter(Boolean).join('|');
    if (list) await this._form('/torrents/resume', { hashes: list });
  }

  async remove(hashes, { deleteFiles = true } = {}) {
    const list = (Array.isArray(hashes) ? hashes : [hashes]).filter(Boolean).join('|');
    if (list) await this._form('/torrents/delete', { hashes: list, deleteFiles: deleteFiles ? 'true' : 'false' });
  }

  /**
   * Find the torrent that matches a magnet/URL among current torrents
   * (used to re-attach after a manager restart). Matches by name fallback.
   */
  async findByUrl(url, nameHint) {
    const all = await this._get('/torrents/info', {});
    for (const t of all || []) {
      if (nameHint && t.name && t.name.toLowerCase() === String(nameHint).toLowerCase()) return t;
    }
    return null;
  }

  // ---- built-in search (works without Jackett) ----

  async searchStart(query, category = 'all') {
    const id = await this._get('/search/start', { query: String(query), category: String(category || 'all') });
    return id; // numeric search id (string)
  }

  async searchStatus(id) {
    return (await this._get('/search/status', { id })) || {};
  }

  async searchResults(id) {
    return (await this._get('/search/results', { id })) || [];
  }
}

module.exports = { QbitClient, isHash };

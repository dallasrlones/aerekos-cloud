'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const axios = require('axios');
const { DownloadList, DownloadItem, DownloadWindow, Indexer } = require('../models');
const { CrudService, fail } = require('../../../shared/crudBase');
const { conductorBase, authHeaders, skipFlag } = require('../../../shared/conductorProxy');
const { QbitClient } = require('../utils/qbit');
const { runYtdlp } = require('../utils/ytdlp');

const SKIP_DOWNLOAD = skipFlag('SKIP_DOWNLOAD');
const SKIP_TORRENT = skipFlag('SKIP_TORRENT');

// ---- host-downloader configuration ----------------------------------------
const QBT_URL = (process.env.QBITTORRENT_URL || '').replace(/\/+$/, '');
const QBT_USER = process.env.QBITTORRENT_USER || 'admin';
const QBT_PASS = process.env.QBITTORRENT_PASS || '';
// The shared download volume is mounted at QBT_SAVE_ROOT inside the qBittorrent
// container and at DM_MEDIA_DIR inside this container (same underlying volume).
const QBT_SAVE_ROOT = process.env.QBITTORRENT_SAVE_ROOT || '/data';
const DM_MEDIA_DIR = process.env.DOWNLOAD_MEDIA_DIR || path.join(os.tmpdir(), 'aerekos-dm-media');
const YT_OUTPUT_DIR = process.env.YT_OUTPUT_DIR || path.join(os.tmpdir(), 'aerekos-dm-yt');
const MAX_CONCURRENT = Math.max(1, parseInt(process.env.MAX_CONCURRENT || '2', 10));
const TORRENT_POLL_MS = Math.max(5000, parseInt(process.env.TORRENT_POLL_MS || '15000', 10));
const TORRENT_TIMEOUT_MS = parseInt(process.env.TORRENT_TIMEOUT_MS || String(12 * 60 * 60 * 1000), 10);
const YT_TIMEOUT_MS = parseInt(process.env.YT_TIMEOUT_MS || String(3 * 60 * 60 * 1000), 10);

function inWindow(win, now = new Date()) {
  if (!win) return true;
  const days = (() => {
    try { return JSON.parse(win.days || '[]'); } catch { return []; }
  })();
  const dow = now.getDay();
  if (days.length && !days.includes(dow) && !days.includes(String(dow))) return false;
  const [sh, sm] = String(win.start || '22:00').split(':').map(Number);
  const [eh, em] = String(win.end || '06:00').split(':').map(Number);
  const startM = sh * 60 + (sm || 0);
  const endM = eh * 60 + (em || 0);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (startM === endM) return true;
  if (startM < endM) return cur >= startM && cur < endM;
  return cur >= startM || cur < endM;
}

// ---- small helpers ---------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitizeName(s) {
  return String(s || '').replace(/[\\/:*?"<>|\x00-\x1f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 180) || 'file';
}

function contentTypeFor(file) {
  const ext = path.extname(String(file || '')).toLowerCase();
  const map = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
    '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.flac': 'audio/flac', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp',
    '.zip': 'application/zip', '.tar': 'application/x-tar', '.gz': 'application/gzip', '.7z': 'application/x-7z-compressed',
    '.rar': 'application/vnd.rar', '.pdf': 'application/pdf', '.srt': 'text/plain', '.ass': 'text/plain', '.sub': 'text/plain',
  };
  return map[ext] || 'application/octet-stream';
}

/** Recursively list files under dir -> [{abs, rel}] (rel uses '/' separators). */
function walkFiles(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries = [];
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else if (e.isFile()) out.push({ abs: full, rel: path.relative(dir, full).split(path.sep).join('/') });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function removeDir(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
}

// ---- qBittorrent client (lazy, shared) -------------------------------------
let _qbt = null;
function qbit() {
  if (!QBT_URL) return null;
  if (!_qbt) _qbt = new QbitClient({ url: QBT_URL, user: QBT_USER, pass: QBT_PASS, timeout: 30000 });
  return _qbt;
}

// ---- storage upload (project bucket OR system bucket) -----------------------
/**
 * Stream a local file into the target bucket via the conductor.
 * Target = system bucket when systemId is set (/api/systems/...), else a
 * project bucket (/api/projects/...). The conductor streams the body
 * straight through to storage_manager.
 */
async function uploadLocalFile({ projectId, systemId, bucket, key, localPath, contentType }) {
  const base = conductorBase();
  const b = encodeURIComponent(bucket || 'downloads');
  const k = String(key).split('/').map(encodeURIComponent).join('/');
  const urlPath = systemId
    ? `/api/services/storage_manager/api/systems/${encodeURIComponent(systemId)}/buckets/${b}/files/${k}`
    : `/api/services/storage_manager/api/projects/${encodeURIComponent(projectId)}/buckets/${b}/files/${k}`;
  const st = fs.statSync(localPath);
  const stream = fs.createReadStream(localPath);
  const res = await axios.post(`${base}${urlPath}`, stream, {
    headers: {
      // System buckets are project-agnostic: route to the shared storage
      // deployment without an x-project-id, otherwise the conductor looks for
      // a per-project storage deployment and 503s "not enabled for this project".
      ...authHeaders(systemId ? null : projectId, {}),
      'Content-Type': contentType || contentTypeFor(localPath),
      'Content-Length': st.size,
    },
    timeout: 30 * 60 * 1000,
    validateStatus: () => true,
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
  });
  try { stream.destroy(); } catch { /* ignore */ }
  if (res.status >= 400) {
    const msg = (res.data && (res.data.error?.message || res.data.message)) || `storage HTTP ${res.status}`;
    throw new Error(`upload ${systemId ? `system/${systemId}` : `project/${projectId}`} bucket=${bucket} key=${key}: ${msg}`);
  }
  return res.data;
}

// ---- ListService (unchanged behavior) ---------------------------------------
class ListService extends CrudService {
  constructor() { super(DownloadList); }

  async create(body) {
    const row = await super.create({
      ...body,
      bucket: body.bucket || 'downloads',
      prefix: body.prefix || '',
    });
    return row;
  }

  async ensureDefaults(projectId) {
    const windows = await DownloadWindow.findAll({ where: { project_id: projectId } });
    let overnight = windows.find((w) => w.name === 'overnight');
    if (!overnight) {
      overnight = await DownloadWindow.create({
        project_id: projectId,
        name: 'overnight',
        days: JSON.stringify([0, 1, 2, 3, 4, 5, 6]),
        start: '22:00',
        end: '06:00',
        timezone: 'local',
      });
    }
    const lists = await this.list(projectId);
    let inbox = lists.find((l) => l.name === 'inbox');
    if (!inbox) {
      inbox = await this.create({
        project_id: projectId,
        name: 'inbox',
        bucket: 'downloads',
        prefix: '',
        window_id: overnight.id,
      });
    }
    return { list: inbox, window: overnight, bucket: 'downloads' };
  }

  async resolveList(projectId, nameOrId) {
    if (!nameOrId) {
      const d = await this.ensureDefaults(projectId);
      return d.list;
    }
    const byId = await DownloadList.findAll({ where: { id: nameOrId, project_id: projectId } });
    if (byId.length) return byId[0];
    const byName = await DownloadList.findAll({ where: { name: nameOrId, project_id: projectId } });
    if (byName.length) return byName[0];
    return this.create({ project_id: projectId, name: nameOrId, bucket: 'downloads' });
  }
}

// ---- DownloadService ---------------------------------------------------------
class DownloadService {
  constructor() {
    this.lists = new ListService();
    this._inflight = new Set();
    this._ticking = false;
  }

  detectKind(url) {
    const u = String(url || '');
    if (u.startsWith('magnet:')) return 'magnet';
    if (/\.torrent(\?|$)/i.test(u)) return 'torrent_url';
    if (/youtu\.be|youtube\.com/i.test(u)) return 'youtube';
    return 'http';
  }

  async addItems(projectId, { list, window, urls, format, system_id, bucket, prefix }) {
    const lst = await this.lists.resolveList(projectId, list);

    const patch = {};
    if (system_id) patch.system_id = String(system_id);
    if (bucket) patch.bucket = String(bucket);
    if (prefix !== undefined) patch.prefix = String(prefix);
    if (window) {
      const wins = await DownloadWindow.findAll({ where: { project_id: projectId, name: window } });
      if (wins.length) patch.window_id = wins[0].id;
      else if (window === 'overnight') {
        const d = await this.lists.ensureDefaults(projectId);
        patch.window_id = d.window.id;
      }
    }
    if (Object.keys(patch).length) await DownloadList.update(lst.id, patch);
    const fresh = (await DownloadList.findAll({ where: { id: lst.id } }))[0] || lst;

    const created = [];
    for (const raw of urls || []) {
      const url = String(raw).trim();
      if (!url) continue;
      const item = await DownloadItem.create({
        project_id: projectId,
        list_id: fresh.id,
        kind: this.detectKind(url),
        url,
        format: format || (this.detectKind(url) === 'youtube' ? 'mp4' : ''),
        status: 'pending',
        progress: '0',
        storage_key: '',
        qbt_hash: '',
        error: '',
        system_id: fresh.system_id || '',
      });
      created.push(item);
    }
    return { list: fresh, items: created };
  }

  async listItems(projectId, listId) {
    return DownloadItem.findAll({ where: { project_id: projectId, list_id: listId } });
  }

  async getItem(id, projectId) {
    const rows = await DownloadItem.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) throw fail(404, 'item not found');
    return rows[0];
  }

  async setStatus(id, projectId, status, extra = {}) {
    await this.getItem(id, projectId);
    await DownloadItem.update(id, { status, ...extra });
    return this.getItem(id, projectId);
  }

  // ---- full CRUD (list/get/update/delete items) ------------------------------
  async listAllItems(projectId, { list, status } = {}) {
    const where = { project_id: projectId };
    if (list) where.list_id = list;
    if (status) where.status = status;
    return DownloadItem.findAll({ where, order: 'created_at DESC' });
  }

  async updateItem(id, projectId, patch = {}) {
    const item = await this.getItem(id, projectId);
    const changes = {};
    if (patch.url !== undefined) changes.url = String(patch.url);
    if (patch.format !== undefined) changes.format = patch.format ? String(patch.format) : '';
    if (patch.status !== undefined && !['pause', 'resume', 'retry'].includes(patch.status)) {
      changes.status = String(patch.status);
    }
    if (patch.error !== undefined) changes.error = String(patch.error || '');
    if (Object.keys(changes).length) await DownloadItem.update(id, changes);
    return this.getItem(id, projectId);
  }

  /** Delete an item; if it is a live qBittorrent torrent, remove it (files included). */
  async deleteItem(id, projectId) {
    const item = await this.getItem(id, projectId);
    if ((item.kind === 'magnet' || item.kind === 'torrent_url') && item.qbt_hash) {
      const client = qbit();
      if (client) {
        try {
          await client.login();
          await client.remove([item.qbt_hash], { deleteFiles: true });
        } catch { /* best effort — the torrent may already be gone */ }
      }
    }
    await DownloadItem.delete(id);
    return { deleted: true, id, qbt_hash: item.qbt_hash || null };
  }

  // ---- search (Jackett first, qBittorrent built-in as fallback) -------------
  async search(projectId, { query, category }) {
    if (SKIP_DOWNLOAD) {
      return { results: [{ title: `fake:${query}`, magnet: 'magnet:?xt=urn:btih:deadbeef', category: category || 'all' }], fake: true, source: 'skip' };
    }
    const indexers = await Indexer.findAll({ where: { project_id: projectId } });
    if (indexers.length) {
      const idx = indexers[0];
      try {
        const res = await axios.get(`${idx.url.replace(/\/$/, '')}/api/v2.0/indexers/all/results`, {
          params: { apikey: idx.apikey, Query: query, Category: category },
          timeout: 20000,
        });
        return { results: res.data?.Results || res.data || [], source: 'jackett' };
      } catch (err) {
        return { results: [], error: err.message, source: 'jackett' };
      }
    }
    const client = qbit();
    if (client) {
      try {
        await client.login();
        const id = await client.searchStart(query, category);
        const t0 = Date.now();
        while (Date.now() - t0 < 30000) {
          const st = await client.searchStatus(id);
          if (st && st.status === 'Running') { await sleep(1500); continue; }
          break;
        }
        const raw = await client.searchResults(id);
        const results = (raw || []).map((r) => ({
          title: r.fileName,
          magnet: r.magnetLink || (r.hash ? `magnet:?xt=urn:btih:${r.hash}` : ''),
          size: r.size, seeders: r.nbLeechs, leechers: r.nbPeers, site: r.siteName,
          category: r.category || category || 'all',
        }));
        return { results, source: 'qbittorrent' };
      } catch (err) {
        return { results: [], error: err.message, source: 'qbittorrent' };
      }
    }
    return { results: [], warning: 'no_indexers' };
  }

  windowAllows(win, now) {
    return inWindow(win, now);
  }

  // ---- tick: start pending + resume orphaned running ------------------------
  async tick(now = new Date()) {
    if (this._ticking) return { skipped: 'already_ticking' };
    this._ticking = true;
    try {
      const started = [];
      const resumed = [];

      const pending = await DownloadItem.findAll({ where: { status: 'pending' } });
      const running = await DownloadItem.findAll({ where: { status: 'running' } });
      const toStart = [];

      for (const item of pending) {
        const list = await this._listFor(item);
        const win = await this._windowFor(list);
        if (!this.windowAllows(win, now)) continue;
        if (this._inflight.has(item.id)) continue;
        toStart.push({ item, resume: false });
      }
      for (const item of running) {
        // Orphaned after a restart (not in this process' in-flight set) -> resume.
        // Torrents re-attach by hash (idempotent); http/youtube restart cleanly.
        if (this._inflight.has(item.id)) continue;
        toStart.push({ item, resume: true });
      }

      let slots = MAX_CONCURRENT - this._inflight.size;
      for (const { item, resume } of toStart) {
        if (slots <= 0) break;
        slots--;
        this._inflight.add(item.id);
        (resume ? resumed : started).push(item.id);
        const job = this._runItem(item)
          .catch(async (err) => {
            try {
              await DownloadItem.update(item.id, { status: 'failed', error: String(err.message || err).slice(0, 500) });
            } catch { /* already gone */ }
          })
          .finally(() => { this._inflight.delete(item.id); });
        this._jobs = this._jobs || new Set();
        this._jobs.add(job);
        job.finally(() => this._jobs.delete(job));
      }
      return { started, resumed, inflight: [...this._inflight] };
    } finally {
      this._ticking = false;
    }
  }

  async _listFor(item) {
    const rows = await DownloadList.findAll({ where: { id: item.list_id } });
    return rows[0] || null;
  }

  async _windowFor(list) {
    if (!list?.window_id) return null;
    const ws = await DownloadWindow.findAll({ where: { id: list.window_id } });
    return ws[0] || null;
  }

  // ---- per-item execution ----------------------------------------------------
  async _runItem(item) {
    const list = await this._listFor(item);
    const kind = item.kind || this.detectKind(item.url);

    if (SKIP_DOWNLOAD) return this.completeFake(item, list);
    if (kind === 'magnet' || kind === 'torrent_url') {
      if (SKIP_TORRENT) return this.completeFake(item, list);
      return this._runTorrent(item, list);
    }
    if (kind === 'youtube') {
      if (SKIP_TORRENT) return this.completeFake(item, list);
      return this._runYouTube(item, list);
    }
    return this._runHttp(item, list);
  }

  async completeFake(item, list) {
    const key = `${list?.prefix || ''}inbox/${item.id}`;
    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: key });
    return key;
  }

  _targetKey(list, subpath) {
    const parts = [String(list?.prefix || ''), String(list?.name || 'downloads'), ...String(subpath).split('/')].filter(Boolean);
    return parts.join('/');
  }

  // ---- HTTP ------------------------------------------------------------------
  async _runHttp(item, list) {
    const dir = path.join(DM_MEDIA_DIR, item.id);
    fs.mkdirSync(dir, { recursive: true });
    let fname = `${item.id}.bin`;
    try { fname = sanitizeName(path.basename(new URL(item.url).pathname) || fname); } catch { /* keep */ }
    const out = path.join(dir, fname);

    await this._downloadToFile(item.url, out);
    const key = this._targetKey(list, fname);
    await uploadLocalFile({
      projectId: item.project_id,
      systemId: list?.system_id,
      bucket: list?.bucket || 'downloads',
      key,
      localPath: out,
    });
    removeDir(dir);
    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: key, error: '' });
    return key;
  }

  async _downloadToFile(url, out, { timeoutMs = 10 * 60 * 1000 } = {}) {
    const res = await axios.get(url, {
      responseType: 'stream',
      timeout: timeoutMs,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    if (res.status >= 400) {
      try { res.data?.destroy(); } catch { /* ignore */ }
      throw new Error(`http ${res.status} for ${String(url).slice(0, 120)}`);
    }
    await new Promise((resolve, reject) => {
      const ws = fs.createWriteStream(out);
      res.data.on('error', (e) => { try { ws.destroy(); } catch { /* ignore */ } reject(e); });
      ws.on('error', reject);
      ws.on('finish', resolve);
      res.data.pipe(ws);
    });
  }

  // ---- YouTube / yt-dlp --------------------------------------------------------
  async _runYouTube(item, list) {
    const format = item.format || 'mp4';
    const outDir = path.join(YT_OUTPUT_DIR, item.id);
    fs.mkdirSync(outDir, { recursive: true });
    let lastPct = '';
    const onLine = (line) => {
      const m = String(line).match(/(\d{1,3}(?:\.\d+)?)%/);
      if (m && m[1] !== lastPct) {
        lastPct = m[1];
        DownloadItem.update(item.id, { progress: m[1] }).catch(() => {});
      }
    };
    const { path: localPath, title } = await runYtdlp({
      url: item.url,
      format,
      outputDir: outDir,
      timeoutMs: YT_TIMEOUT_MS,
      onProgress: onLine,
    });
    const ext = (path.extname(localPath) || '.' + (format === 'mp3' ? 'mp3' : 'mp4')).replace(/^\./, '');
    const fname = `${sanitizeName(title)}.${ext}`;
    const key = this._targetKey(list, fname);
    await uploadLocalFile({
      projectId: item.project_id,
      systemId: list?.system_id,
      bucket: list?.bucket || 'downloads',
      key,
      localPath,
      contentType: format === 'mp3' ? 'audio/mpeg' : 'video/mp4',
    });
    removeDir(outDir);
    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: key, error: '' });
    return key;
  }

  // ---- qBittorrent -------------------------------------------------------------
  async _runTorrent(item, list) {
    const client = qbit();
    if (!client) {
      throw new Error('torrent requested but QBITTORRENT_URL is not configured (run a qBittorrent container and set QBITTORRENT_URL/USER/PASS on download_manager)');
    }
    await client.login();

    const itemDir = item.id; // subdir inside the shared volume
    const qbtSavePath = path.posix.join(QBT_SAVE_ROOT, itemDir);
    const localDir = path.join(DM_MEDIA_DIR, itemDir);

    // 1) ensure the torrent exists in qBittorrent (re-attach after restart)
    let hash = item.qbt_hash;
    if (hash) {
      const info = await client.info([hash]);
      if (!info.length) hash = '';
    }
    if (!hash) {
      hash = await client.addTorrent({ urls: item.url, savepath: qbtSavePath });
      if (!hash) throw new Error('qBittorrent add returned no hash (torrent vanished or rejected)');
      await DownloadItem.update(item.id, { qbt_hash: hash, status: 'running', progress: '0' });
    }

    // 2) poll until complete
    const startedAt = Date.now();
    for (;;) {
      const infos = await client.info([hash]);
      const info = infos[0];
      if (!info) throw new Error('torrent disappeared from qBittorrent while waiting');
      const pct = Math.min(100, Math.round((Number(info.progress) || 0) * 100));
      await DownloadItem.update(item.id, { progress: String(pct) });
      const done = Number(info.progress) >= 0.999 || ['upload', 'pausedUP', 'stalledUP', 'forcedUP'].includes(info.state);
      if (done) break;
      if (info.state === 'error') throw new Error(`torrent error: ${info.status_text || 'unknown'}`);
      if (Date.now() - startedAt > TORRENT_TIMEOUT_MS) throw new Error(`torrent timed out at ${pct}% after ${Math.round(TORRENT_TIMEOUT_MS / 3600000)}h`);
      await sleep(TORRENT_POLL_MS);
    }

    // 3) upload everything that landed in the per-item dir (preserves structure)
    const files = walkFiles(localDir);
    if (!files.length) throw new Error(`torrent complete but no files found at ${localDir}`);
    const keys = [];
    for (const f of files) {
      const key = this._targetKey(list, f.rel);
      await uploadLocalFile({
        projectId: item.project_id,
        systemId: list?.system_id,
        bucket: list?.bucket || 'downloads',
        key,
        localPath: f.abs,
        contentType: contentTypeFor(f.abs),
      });
      keys.push(key);
    }

    // 4) clean up in qBittorrent (removes the files from the shared volume too)
    try { await client.remove([hash], { deleteFiles: true }); } catch { /* best effort */ }
    removeDir(localDir);

    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: keys[0], error: '' });
    return keys[0];
  }
}

module.exports = { ListService, DownloadService, inWindow, SKIP_DOWNLOAD, SKIP_TORRENT, walkFiles, uploadLocalFile };

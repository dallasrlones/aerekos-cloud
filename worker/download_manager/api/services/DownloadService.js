'use strict';

const { DownloadList, DownloadItem, DownloadWindow, Indexer } = require('../models');
const { CrudService, fail } = require('../../../shared/crudBase');
const axios = require('axios');

const { conductorBase, authHeaders, skipFlag } = require('../../../shared/conductorProxy');

const SKIP_DOWNLOAD = skipFlag('SKIP_DOWNLOAD');
const SKIP_TORRENT = skipFlag('SKIP_TORRENT');

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

class DownloadService {
  constructor() {
    this.lists = new ListService();
  }

  detectKind(url) {
    const u = String(url || '');
    if (u.startsWith('magnet:')) return 'magnet';
    if (/\.torrent(\?|$)/i.test(u)) return 'torrent_url';
    if (/youtu\.be|youtube\.com/i.test(u)) return 'youtube';
    return 'http';
  }

  async addItems(projectId, { list, window, urls, format }) {
    const lst = await this.lists.resolveList(projectId, list);
    let windowId = lst.window_id;
    if (window) {
      const wins = await DownloadWindow.findAll({ where: { project_id: projectId, name: window } });
      if (wins.length) windowId = wins[0].id;
      else if (window === 'overnight') {
        const d = await this.lists.ensureDefaults(projectId);
        windowId = d.window.id;
      }
      if (windowId && windowId !== lst.window_id) await DownloadList.update(lst.id, { window_id: windowId });
    }
    const created = [];
    for (const raw of urls || []) {
      const url = String(raw).trim();
      if (!url) continue;
      const item = await DownloadItem.create({
        project_id: projectId,
        list_id: lst.id,
        kind: this.detectKind(url),
        url,
        format: format || (this.detectKind(url) === 'youtube' ? 'mp4' : ''),
        status: 'pending',
        progress: '0',
        storage_key: '',
        error: '',
      });
      created.push(item);
    }
    return { list: lst, items: created };
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

  async search(projectId, { query, category }) {
    if (SKIP_DOWNLOAD || SKIP_TORRENT) {
      return { results: [{ title: `fake:${query}`, magnet: 'magnet:?xt=urn:btih:deadbeef', category: category || 'all' }], fake: true };
    }
    const indexers = await Indexer.findAll({ where: { project_id: projectId } });
    if (!indexers.length) return { results: [], warning: 'no_indexers' };
    const idx = indexers[0];
    try {
      const res = await axios.get(`${idx.url.replace(/\/$/, '')}/api/v2.0/indexers/all/results`, {
        params: { apikey: idx.api_key_secret, Query: query, Category: category },
        timeout: 15000,
      });
      return { results: res.data?.Results || res.data || [] };
    } catch (err) {
      return { results: [], error: err.message };
    }
  }

  windowAllows(win, now) {
    return inWindow(win, now);
  }

  async tick(now = new Date()) {
    const items = await DownloadItem.findAll({ where: { status: 'pending' } });
    const started = [];
    const paused = [];
    for (const item of items) {
      const lists = await DownloadList.findAll({ where: { id: item.list_id } });
      const list = lists[0];
      let win = null;
      if (list?.window_id) {
        const ws = await DownloadWindow.findAll({ where: { id: list.window_id } });
        win = ws[0] || null;
      }
      if (!this.windowAllows(win, now)) {
        continue;
      }
      await DownloadItem.update(item.id, { status: 'running', progress: '1' });
      started.push(item.id);
      if (SKIP_DOWNLOAD) {
        await this.completeFake(item, list);
      } else {
        try {
          await this.completeLive(item, list);
        } catch (err) {
          await DownloadItem.update(item.id, { status: 'failed', error: String(err.message || err).slice(0, 500) });
        }
      }
    }
    const running = await DownloadItem.findAll({ where: { status: 'running' } });
    for (const item of running) {
      const lists = await DownloadList.findAll({ where: { id: item.list_id } });
      const list = lists[0];
      let win = null;
      if (list?.window_id) {
        const ws = await DownloadWindow.findAll({ where: { id: list.window_id } });
        win = ws[0] || null;
      }
      if (win && !this.windowAllows(win, now) && (item.kind === 'magnet' || item.kind === 'torrent_url')) {
        await DownloadItem.update(item.id, { status: 'paused' });
        paused.push(item.id);
      }
    }
    return { started, paused };
  }

  async completeFake(item, list) {
    const key = `${list?.prefix || ''}inbox/${item.id}`;
    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: key });
    return key;
  }

  async completeLive(item, list) {
    const kind = item.kind || this.detectKind(item.url);
    if (kind === 'magnet' || kind === 'torrent_url' || kind === 'youtube') {
      if (SKIP_TORRENT) return this.completeFake(item, list);
      const err = new Error(`${kind} requires a host downloader (yt-dlp / aria2c); HTTP URLs are fetched directly`);
      throw err;
    }
    const res = await axios.get(item.url, {
      responseType: 'arraybuffer',
      timeout: 120000,
      maxRedirects: 5,
      maxContentLength: 64 * 1024 * 1024,
      validateStatus: () => true,
    });
    if (res.status >= 400) throw new Error(`http ${res.status}`);
    const key = `${list?.prefix || ''}inbox/${item.id}`;
    const bucket = list?.bucket || 'downloads';
    const put = await axios.post(
      `${conductorBase()}/api/services/storage_manager/api/projects/${encodeURIComponent(item.project_id)}/buckets/${encodeURIComponent(bucket)}/files/${key}`,
      Buffer.from(res.data),
      {
        headers: {
          ...authHeaders(item.project_id),
          'Content-Type': 'application/octet-stream',
        },
        timeout: 120000,
        validateStatus: () => true,
        maxBodyLength: Infinity,
      },
    );
    if (put.status >= 400) throw new Error(put.data?.error?.message || `storage ${put.status}`);
    await DownloadItem.update(item.id, { status: 'completed', progress: '100', storage_key: key, error: '' });
    return key;
  }
}

module.exports = { ListService, DownloadService, inWindow, SKIP_DOWNLOAD };

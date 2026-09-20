'use strict';

const { isNetError } = require('./cronMatch');
const { agentModels } = require('./agentModels');

const MAX_PAGES = 20;
const MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_TTL_DAYS = 14;
const RESUME_STATUSES = ['queued', 'fetching', 'waiting_net', 'waiting_computer', 'ingesting'];

function sourceDocId(url) {
  return `src:${String(url || '').trim().slice(0, 180)}`;
}

function looksLearn(text) {
  return /\b(learn|whitepaper|update yourself|ingest (this|the) (paper|repo|docs)|skills rag)\b/i.test(String(text || ''));
}

function inferLearnSources(text) {
  const t = String(text || '').trim();
  const urls = t.match(/https?:\/\/[^\s)]+/gi) || [];
  if (urls.length) {
    return urls.slice(0, MAX_PAGES).map((url) => ({ title: url.replace(/^https?:\/\//, '').slice(0, 80), url, kind: 'web' }));
  }
  const git = t.match(/\b(?:github\.com\/[^\s]+|update yourself on (?:this )?(?:repo|github)[^\n]*)/i);
  if (/\bgithub\b|\brepo\b/i.test(t) && git) {
    return [{ title: 'repo', url: git[0].startsWith('http') ? git[0] : `https://${git[0]}`, kind: 'git' }];
  }
  const sentence = t.replace(/^\s*(learn that|learn|remember)\s+/i, '').trim();
  if (sentence) {
    return [{ title: 'user sentence', url: `inline:${sentence.slice(0, 80)}`, kind: 'paper', text: sentence }];
  }
  return [];
}

function capPages(pages, maxPages = MAX_PAGES, maxBytes = MAX_BYTES) {
  const out = [];
  let bytes = 0;
  for (const p of pages || []) {
    if (out.length >= maxPages) break;
    const n = Buffer.byteLength(String(p.text || p.body || ''), 'utf8');
    if (bytes + n > maxBytes) break;
    bytes += n;
    out.push(p);
  }
  return { pages: out, bytes, truncated: (pages || []).length > out.length };
}

class AgentLearnService {
  constructor(deps = {}) {
    this.rag = deps.rag;
    this.fetchPage = deps.fetchPage;
    this.jobs = new Map();
    this.pages = new Map();
    this.sources = new Map();
    if (deps.memory === true) return;
    if (deps.Job || deps.Page || deps.Source) {
      this.Job = deps.Job;
      this.Page = deps.Page;
      this.Source = deps.Source;
      return;
    }
    const m = agentModels();
    if (m) {
      this.Job = m.AgentLearnJob;
      this.Page = m.AgentLearnPage;
      this.Source = m.AgentKnowledgeSource;
    }
  }

  async hydrate(projectId, agentId) {
    if (!this.Job) return [];
    const rows = await this.Job.findAll({ where: { project_id: projectId, agent_id: agentId } });
    for (const j of rows || []) {
      this.jobs.set(j.id, j);
      if (this.Page) {
        const pages = await this.Page.findAll({ where: { job_id: j.id } });
        this.pages.set(j.id, pages || []);
      }
    }
    if (this.Source) {
      const src = await this.Source.findAll({ where: { project_id: projectId, agent_id: agentId } });
      for (const s of src || []) this.sources.set(s.url, s);
    }
    return rows || [];
  }

  async listResumable(projectId, agentId) {
    await this.hydrate(projectId, agentId);
    return [...this.jobs.values()].filter((j) => (
      j.project_id === projectId && j.agent_id === agentId && RESUME_STATUSES.includes(j.status)
    ));
  }

  async createJob({ projectId, agentId, workItemId = '', sources = [], claim = 'learn' }) {
    let id = `learn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = {
      id,
      project_id: projectId,
      agent_id: agentId,
      work_item_id: workItemId,
      status: 'queued',
      checkpoint: JSON.stringify({ next_index: 0, bytes: 0 }),
      claim,
      created_at: new Date().toISOString(),
    };
    if (this.Job) {
      const created = await this.Job.create({
        project_id: projectId,
        agent_id: agentId,
        work_item_id: workItemId,
        status: 'queued',
        checkpoint: row.checkpoint,
        claim,
      });
      id = created.id;
      row.id = id;
    }
    let pages = (sources || []).slice(0, MAX_PAGES).map((s, i) => ({
      id: `${id}-p${i}`,
      project_id: projectId,
      job_id: id,
      url: s.url,
      title: s.title || s.url,
      kind: s.kind || 'web',
      status: s.text ? 'fetched' : 'queued',
      text: s.text || '',
      local_path: '',
      error: '',
    }));
    if (this.Page) {
      const stored = [];
      for (const p of pages) {
        const created = await this.Page.create({
          project_id: projectId,
          job_id: id,
          url: p.url,
          title: p.title,
          kind: p.kind,
          status: p.status,
          text: p.text || '',
          local_path: '',
          error: '',
        });
        stored.push({ ...p, id: created.id, job_id: id });
      }
      pages = stored;
    }
    this.jobs.set(id, row);
    this.pages.set(id, pages);
    return { job: row, pages };
  }

  getJob(id) {
    return this.jobs.get(id) || null;
  }

  listPages(jobId) {
    return this.pages.get(jobId) || [];
  }

  async _persistJob(job) {
    if (!this.Job || !job?.id) return;
    try {
      await this.Job.update(job.id, {
        status: job.status,
        checkpoint: job.checkpoint,
        claim: job.claim || '',
        work_item_id: job.work_item_id || '',
      });
    } catch { /* */ }
  }

  async _persistPage(page) {
    if (!this.Page || !page?.id) return;
    try {
      await this.Page.update(page.id, {
        status: page.status,
        text: page.text || '',
        local_path: page.local_path || '',
        error: page.error || '',
        title: page.title || '',
        kind: page.kind || 'web',
      });
    } catch { /* */ }
  }

  async markPage(jobId, pageId, patch) {
    const pages = this.pages.get(jobId) || [];
    const p = pages.find((x) => x.id === pageId);
    if (p) Object.assign(p, patch);
    await this._persistPage(p);
    return p;
  }

  async setJobStatus(jobId, status, extra = {}) {
    const job = this.jobs.get(jobId);
    if (job) Object.assign(job, { status, ...extra });
    await this._persistJob(job);
    return job;
  }

  classifyFetchError(err) {
    if (isNetError(err) || /computer_down|waiting_computer/i.test(String(err?.message || err))) {
      const computer = /computer/i.test(String(err?.message || err));
      return { blocked: true, status: computer ? 'waiting_computer' : 'waiting_net' };
    }
    return { blocked: false, status: 'failed' };
  }

  async fetchRemaining(jobId, { fetchImpl } = {}) {
    const job = this.jobs.get(jobId);
    if (!job) return { ok: false, error: 'job not found' };
    const pages = this.pages.get(jobId) || [];
    const fetchFn = fetchImpl || this.fetchPage;
    job.status = 'fetching';
    await this._persistJob(job);
    let bytes = JSON.parse(job.checkpoint || '{}').bytes || 0;
    for (const p of pages) {
      if (p.status === 'fetched' || p.status === 'ingested' || p.status === 'skipped') continue;
      if (bytes >= MAX_BYTES) break;
      try {
        if (String(p.url || '').startsWith('inline:')) {
          p.status = 'fetched';
          p.text = p.text || String(p.url).slice(7);
          await this._persistPage(p);
          continue;
        }
        if (!fetchFn) throw new Error('ENOTFOUND no fetcher');
        const got = await fetchFn(p.url, { maxBytes: MAX_BYTES - bytes });
        if (got?.computer_down) {
          job.status = 'waiting_computer';
          p.status = 'failed';
          p.error = 'blocked_net';
          await this._persistPage(p);
          await this._persistJob(job);
          return { ok: false, job, waiting: 'waiting_computer' };
        }
        if (!got?.ok) {
          const cls = this.classifyFetchError(got?.error || got);
          p.status = 'failed';
          p.error = cls.blocked ? 'blocked_net' : String(got?.error || 'fetch failed');
          await this._persistPage(p);
          if (cls.blocked) {
            job.status = cls.status;
            await this._persistJob(job);
            return { ok: false, job, waiting: cls.status };
          }
          continue;
        }
        p.text = String(got.text || got.body || '').slice(0, MAX_BYTES);
        p.local_path = got.path || '';
        p.status = 'fetched';
        bytes += Buffer.byteLength(p.text, 'utf8');
        await this._persistPage(p);
      } catch (e) {
        const cls = this.classifyFetchError(e);
        p.status = 'failed';
        p.error = cls.blocked ? 'blocked_net' : e.message;
        await this._persistPage(p);
        if (cls.blocked) {
          job.status = cls.status;
          await this._persistJob(job);
          return { ok: false, job, waiting: cls.status };
        }
      }
    }
    job.checkpoint = JSON.stringify({
      next_index: pages.filter((x) => x.status === 'fetched' || x.status === 'ingested').length,
      bytes,
    });
    job.status = 'waiting_ask';
    await this._persistJob(job);
    return { ok: true, job, pages };
  }

  async ingestRemaining(jobId, { rag, collection, projectId } = {}) {
    const job = this.jobs.get(jobId);
    const pages = this.pages.get(jobId) || [];
    const ragSvc = rag || this.rag;
    if (!job) return { ok: false, error: 'job not found' };
    job.status = 'ingesting';
    await this._persistJob(job);
    const ingested = [];
    const skipped = [];
    for (const p of pages) {
      if (p.status === 'ingested' || p.status === 'skipped') continue;
      if (p.status !== 'fetched' || !p.text) continue;
      const docId = sourceDocId(p.url);
      try {
        if (ragSvc?.hasDocument && await ragSvc.hasDocument(projectId, collection, docId)) {
          p.status = 'ingested';
          skipped.push(p.url);
          await this._persistPage(p);
          continue;
        }
        if (ragSvc?.ingest) {
          await ragSvc.ingest(collection, projectId, {
            title: p.title || p.url,
            text: p.text,
            doc_id: docId,
            metadata: { source: p.url, kind: p.kind },
          });
        }
        p.status = 'ingested';
        ingested.push(p.url);
        await this._persistPage(p);
        const src = {
          url: p.url,
          kind: p.kind,
          fetched_at: new Date().toISOString(),
          collection_id: collection,
          status: 'ingested',
          ttl_days: DEFAULT_TTL_DAYS,
          project_id: job.project_id,
          agent_id: job.agent_id,
        };
        this.sources.set(p.url, src);
        if (this.Source) {
          const existing = await this.Source.findAll({
            where: { project_id: job.project_id, agent_id: job.agent_id, url: p.url },
          }).catch(() => []);
          const payload = {
            url: p.url,
            kind: p.kind || 'web',
            fetched_at: src.fetched_at,
            ttl_days: String(DEFAULT_TTL_DAYS),
            collection_id: collection || '',
            status: 'ingested',
            etag: '',
            sha: '',
          };
          if (existing?.[0]) await this.Source.update(existing[0].id, payload);
          else {
            await this.Source.create({
              project_id: job.project_id,
              agent_id: job.agent_id,
              ...payload,
            });
          }
        }
      } catch (e) {
        const cls = this.classifyFetchError(e);
        if (cls.blocked) {
          job.status = cls.status;
          await this._persistJob(job);
          return { ok: false, job, waiting: cls.status, ingested, skipped };
        }
        p.status = 'failed';
        p.error = e.message;
        await this._persistPage(p);
      }
    }
    job.status = 'done';
    await this._persistJob(job);
    return { ok: true, job, ingested, skipped };
  }

  staleSources(now = Date.now(), ttlDays = DEFAULT_TTL_DAYS) {
    const out = [];
    const ms = ttlDays * 24 * 60 * 60 * 1000;
    for (const s of this.sources.values()) {
      const at = Date.parse(s.fetched_at || 0);
      const ttl = Number(s.ttl_days || ttlDays) * 24 * 60 * 60 * 1000;
      if (!at || now - at > (ttl || ms)) out.push({ ...s, status: 'stale' });
    }
    return out;
  }
}

module.exports = {
  AgentLearnService,
  sourceDocId,
  looksLearn,
  inferLearnSources,
  capPages,
  MAX_PAGES,
  MAX_BYTES,
  DEFAULT_TTL_DAYS,
};

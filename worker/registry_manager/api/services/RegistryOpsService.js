'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);
const { WantedImage } = require('../models');

function inWindow(windowStr, now = new Date()) {
  const w = String(windowStr || '').trim();
  if (!w) return true;
  const m = w.match(/^(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})$/);
  if (!m) return true;
  const start = Number(m[1]) * 60 + Number(m[2]);
  const end = Number(m[3]) * 60 + Number(m[4]);
  const cur = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return cur >= start && cur < end;
  return cur >= start || cur < end;
}

class RegistryOpsService {
  constructor(deps = {}) {
    this.Wanted = deps.Wanted || WantedImage;
  }

  assertP(p) {
    if (!p || !String(p).trim()) {
      const e = new Error('project_id required');
      e.status = 400;
      throw e;
    }
  }

  async inventory() {
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
      return { images: [], skipped: true };
    }
    try {
      const { stdout } = await execFileAsync('docker', ['images', '--format', '{{json .}}'], { timeout: 15000 });
      const images = String(stdout || '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((l) => {
          try {
            const j = JSON.parse(l);
            return {
              name: j.Repository || j.repository,
              tag: j.Tag || j.tag,
              digest: j.Digest || j.ID || j.id,
              size: j.Size || j.size,
              arch: j.Architecture || process.arch,
              os: j.OS || process.platform,
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean);
      return { images };
    } catch (err) {
      return { images: [], error: err.message };
    }
  }

  async listWanted(projectId) {
    this.assertP(projectId);
    return this.Wanted.findAll({ where: { project_id: projectId } });
  }

  async createWanted(body) {
    this.assertP(body.project_id);
    const name = String(body.name || body.upstream || '').trim();
    if (!name) {
      const e = new Error('name or upstream required');
      e.status = 400;
      throw e;
    }
    return this.Wanted.create({
      project_id: body.project_id,
      name,
      upstream: String(body.upstream || name),
      dest_tag: String(body.dest_tag || ''),
      platforms: String(body.platforms || 'host'),
      window: String(body.window || '02:00-06:00'),
      enabled: body.enabled === false ? '0' : '1',
      status: 'pending',
      last_error: '',
    });
  }

  async updateWanted(id, projectId, body) {
    const rows = await this.Wanted.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    const patch = { ...(body || {}) };
    delete patch.id;
    delete patch.project_id;
    if (Object.keys(patch).length) await this.Wanted.update(id, patch);
    const next = await this.Wanted.findAll({ where: { id, project_id: projectId } });
    return next[0];
  }

  async delWanted(id, projectId) {
    const rows = await this.Wanted.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Not found');
      e.status = 404;
      throw e;
    }
    await this.Wanted.delete(id);
    return { deleted: true, id };
  }

  async runNow(id, projectId) {
    const row = await this.updateWanted(id, projectId, { status: 'pulling', last_error: '' });
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
      return { item: row, ran: true, skipped: true };
    }
    const ref = String(row.upstream || row.name || '').trim();
    if (!ref) {
      const e = new Error('upstream image required');
      e.status = 400;
      throw e;
    }
    try {
      await execFileAsync('docker', ['pull', ref], { timeout: 300000 });
      const updated = await this.updateWanted(id, projectId, { status: 'ok', last_error: '' });
      return { item: updated, ran: true, pulled: ref };
    } catch (err) {
      const updated = await this.updateWanted(id, projectId, { status: 'error', last_error: err.message });
      return { item: updated, ran: true, pulled: ref, error: err.message };
    }
  }

  isInWindow(windowStr) {
    return inWindow(windowStr);
  }

  /**
   * Project-scoped image picker: wanted + docker artifacts + aer-cmp-* we built.
   * Never dump host `docker images` (aerekos-* / compose).
   */
  async projectImages(projectId) {
    this.assertP(projectId);
    const wanted = await this.listWanted(projectId);
    const { Artifact } = require('../models');
    const artifacts = Artifact
      ? await Artifact.findAll({ where: { project_id: projectId, kind: 'docker' } }).catch(() => [])
      : [];
    const images = [];
    for (const w of wanted) {
      images.push({
        ref: w.upstream || w.name,
        name: w.name,
        kind: 'wanted',
        id: w.id,
      });
    }
    for (const a of artifacts || []) {
      const ref = a.uri || a.name;
      if (!ref) continue;
      if (!images.some((i) => i.ref === ref)) {
        images.push({ ref, name: a.name, kind: 'artifact', id: a.id });
      }
    }
    if (process.env.SKIP_DOCKER !== '1' && process.env.SKIP_DOCKER !== 'true') {
      try {
        const { stdout } = await execFileAsync('docker', ['images', '--format', '{{.Repository}}:{{.Tag}}'], { timeout: 15000 });
        String(stdout || '')
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l && l.startsWith('aer-cmp-') && !l.endsWith(':<none>'))
          .forEach((ref) => {
            if (!images.some((i) => i.ref === ref)) images.push({ ref, name: ref, kind: 'built' });
          });
      } catch (_) { /* */ }
    }
    return { images };
  }

  async importTar(projectId, tarPath, name) {
    this.assertP(projectId);
    if (process.env.SKIP_DOCKER === '1' || process.env.SKIP_DOCKER === 'true') {
      return { imported: true, skipped: true, ref: name || 'imported' };
    }
    if (!tarPath) {
      const e = new Error('tar_path required');
      e.status = 400;
      throw e;
    }
    const { stdout, stderr } = await execFileAsync('docker', ['load', '-i', tarPath], {
      timeout: 300000,
      maxBuffer: 4 * 1024 * 1024,
    });
    const logs = `${stdout || ''}${stderr || ''}`;
    const m = logs.match(/Loaded image:\s+(\S+)/);
    const ref = (m && m[1]) || name || 'imported';
    try {
      const { Artifact } = require('../models');
      if (Artifact) {
        await Artifact.create({
          project_id: projectId,
          name: String(name || ref),
          kind: 'docker',
          version: 'imported',
          uri: ref,
        });
      }
    } catch (_) { /* */ }
    return { imported: true, ref, logs };
  }
}

module.exports = { RegistryOpsService, inWindow };

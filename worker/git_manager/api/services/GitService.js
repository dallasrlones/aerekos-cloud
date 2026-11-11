const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const GIT_BIN = process.env.GIT_BIN || 'git';

/** Thin wrapper around the real `git` binary operating on bare repositories. */
class GitService {
  // When SKIP_GIT=1 (tests / hosts without git) we only manage metadata and skip
  // filesystem git operations. Real transport is exercised in E2E against the container.
  enabled() {
    return process.env.SKIP_GIT !== '1' && process.env.SKIP_GIT !== 'true';
  }

  run(args, opts = {}) {
    return new Promise((resolve, reject) => {
      execFile(GIT_BIN, args, { maxBuffer: 16 * 1024 * 1024, ...opts }, (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  async initBare(dir, defaultBranch = 'main') {
    if (!this.enabled()) return;
    fs.mkdirSync(dir, { recursive: true });
    await this.run(['init', '--bare', `--initial-branch=${defaultBranch}`, dir]);
    // Allow Smart-HTTP push to the bare repo.
    await this.run(['--git-dir', dir, 'config', 'http.receivepack', 'true']);
  }

  async setDefaultBranch(dir, branch) {
    if (!this.enabled()) return;
    await this.run(['--git-dir', dir, 'symbolic-ref', 'HEAD', `refs/heads/${branch}`]);
  }

  async listBranches(dir) {
    if (!this.enabled()) return [];
    try {
      const out = await this.run([
        '--git-dir', dir, 'for-each-ref', '--format=%(refname:short)%09%(objectname)', 'refs/heads'
      ]);
      return out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const [name, sha] = line.split('\t');
          return { name, sha };
        });
    } catch {
      return [];
    }
  }

  async listCommits(dir, branch, limit = 20) {
    if (!this.enabled()) return [];
    const n = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 200);
    try {
      // Unit-separated fields, record-separated by \x1e.
      const fmt = '%H%x1f%an%x1f%aI%x1f%s%x1e';
      const out = await this.run([
        '--git-dir', dir, 'log', branch, `--format=${fmt}`, `-n`, String(n)
      ]);
      return out
        .split('\x1e')
        .map((r) => r.replace(/^\n/, ''))
        .filter(Boolean)
        .map((rec) => {
          const [sha, author, date, message] = rec.split('\x1f');
          return { sha, author, date, message };
        });
    } catch {
      return [];
    }
  }

  installPreReceiveHook(dir) {
    if (!this.enabled()) return;
    const hookDir = path.join(dir, 'hooks');
    fs.mkdirSync(hookDir, { recursive: true });
    const hook = `#!/bin/sh
# Protect default branch unless AEREKOS_ALLOW_DIRECT=1
while read oldrev newrev refname; do
  case "$refname" in
    refs/heads/main|refs/heads/master)
      if [ "$AEREKOS_ALLOW_DIRECT" != "1" ]; then
        echo "direct push to $refname denied; open a pull request" >&2
        exit 1
      fi
      ;;
  esac
done
`;
    const hookPath = path.join(hookDir, 'pre-receive');
    fs.writeFileSync(hookPath, hook, { mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
  }

  async mergeFastForward(bareDir, { source, target = 'main' }) {
    if (!this.enabled()) return { skipped: true };
    const src = `refs/heads/${source}`;
    const dst = `refs/heads/${target}`;
    try {
      await this.run(['--git-dir', bareDir, 'merge-base', '--is-ancestor', dst, src]);
    } catch {
      const e = new Error('not a fast-forward; rebase source onto target');
      e.status = 409;
      throw e;
    }
    await this.run(['--git-dir', bareDir, 'update-ref', dst, src]);
    let sha = '';
    try {
      sha = String(await this.run(['--git-dir', bareDir, 'rev-parse', dst])).trim();
    } catch (_) { /* ignore */ }
    return { merged: true, target, source, sha };
  }

  async lsTree(bareDir, ref = 'HEAD', treePath = '') {
    if (!this.enabled()) return [];
    const spec = treePath ? `${ref}:${treePath.replace(/^\/+/, '')}` : ref;
    try {
      const out = await this.run(['--git-dir', bareDir, 'ls-tree', '-l', spec]);
      return out
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const m = line.match(/^(\S+)\s+(\S+)\s+(\S+)\s+(\S+)\t(.*)$/);
          if (!m) return null;
          return { mode: m[1], type: m[2], sha: m[3], size: m[4] === '-' ? null : Number(m[4]), name: m[5] };
        })
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  async showBlob(bareDir, ref, filePath, maxBytes = 1024 * 1024) {
    if (!this.enabled()) return { binary: false, content: '', truncated: false };
    const spec = `${ref}:${String(filePath || '').replace(/^\/+/, '')}`;
    try {
      const buf = await new Promise((resolve, reject) => {
        execFile(GIT_BIN, ['--git-dir', bareDir, 'show', spec], { encoding: 'buffer', maxBuffer: maxBytes + 64 }, (err, stdout) => {
          if (err) return reject(err);
          resolve(stdout);
        });
      });
      const truncated = buf.length > maxBytes;
      const slice = buf.slice(0, maxBytes);
      const binary = slice.includes(0);
      return {
        binary,
        content: binary ? '' : slice.toString('utf8'),
        content_base64: binary ? slice.toString('base64') : undefined,
        size: buf.length,
        truncated,
      };
    } catch (e) {
      const err = new Error('file not found');
      err.status = 404;
      throw err;
    }
  }

  async showFile(bareDir, ref, filePath) {
    if (!this.enabled()) return '';
    try {
      return await this.run(['--git-dir', bareDir, 'show', `${ref}:${filePath}`]);
    } catch {
      return '';
    }
  }

  async diff(bareDir, { source, target = 'main' }) {
    if (!this.enabled()) return '';
    try {
      return await this.run(['--git-dir', bareDir, 'diff', `${target}...${source}`]);
    } catch {
      return '';
    }
  }

  installPostReceiveHook(dir, { projectId, repoId, repoName }) {
    if (!this.enabled()) return;
    const hookDir = path.join(dir, 'hooks');
    fs.mkdirSync(hookDir, { recursive: true });
    const home = process.env.GIT_MANAGER_HOME || '/app/git_manager';
    const esc = (s) => String(s).replace(/'/g, "'\\''");
    const hook = `#!/bin/sh
# aerekos git_manager post-receive hook — records push events back to the service.
exec node "${home}/scripts/notifyPush.js" '${esc(projectId)}' '${esc(repoId)}' '${esc(repoName)}'
`;
    const hookPath = path.join(hookDir, 'post-receive');
    fs.writeFileSync(hookPath, hook, { mode: 0o755 });
    fs.chmodSync(hookPath, 0o755);
  }

  async revParse(bareDir, ref) {
    if (!this.enabled()) return '';
    try {
      return String(await this.run(['--git-dir', bareDir, 'rev-parse', ref])).trim();
    } catch {
      return '';
    }
  }

  async assertBaseSha(bareDir, branch, baseSha) {
    if (!baseSha) return;
    const tip = await this.revParse(bareDir, `refs/heads/${branch}`);
    if (!tip) {
      const e = new Error(`branch "${branch}" has no tip yet; cannot verify base_sha`);
      e.status = 409;
      e.code = 'BASE_SHA_MISMATCH';
      throw e;
    }
    if (String(baseSha).trim() !== tip) {
      const e = new Error(`branch moved — expected ${baseSha}, tip is ${tip}`);
      e.status = 409;
      e.code = 'BASE_SHA_MISMATCH';
      throw e;
    }
  }

  async createBranch(bareDir, { name, from = 'main' } = {}) {
    if (!this.enabled()) return { skipped: true, name, from };
    const branch = String(name || '').trim();
    if (!/^[a-zA-Z0-9._\/-]{1,100}$/.test(branch)) {
      const e = new Error('branch name contains invalid characters');
      e.status = 400;
      throw e;
    }
    const existing = await this.revParse(bareDir, `refs/heads/${branch}`);
    if (existing) {
      const e = new Error(`branch "${branch}" already exists`);
      e.status = 409;
      e.code = 'BRANCH_EXISTS';
      throw e;
    }
    let fromSha = await this.revParse(bareDir, `refs/heads/${from}`);
    if (!fromSha) fromSha = await this.revParse(bareDir, from);
    if (!fromSha) {
      const e = new Error(`source ref "${from}" not found`);
      e.status = 404;
      throw e;
    }
    await this.run(['--git-dir', bareDir, 'update-ref', `refs/heads/${branch}`, fromSha]);
    return { created: true, name: branch, from, sha: fromSha };
  }

  async commitFile(bareDir, {
    branch = 'main',
    filePath = 'stack.json',
    content = '',
    message = 'update',
    baseSha,
  } = {}) {
    if (!this.enabled()) return { skipped: true };
    await this.assertBaseSha(bareDir, branch, baseSha);
    const os = require('os');
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-wt-'));
    try {
      try {
        await this.run(['--git-dir', bareDir, '--work-tree', checkout, 'checkout', '-f', branch]);
      } catch {
        try {
          await this.run(['--git-dir', bareDir, '--work-tree', checkout, 'checkout', '--orphan', branch]);
        } catch { /* still empty */ }
      }
      const dest = path.join(checkout, filePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, content);
      await this.run(['--git-dir', bareDir, '--work-tree', checkout, 'add', '--', filePath]);
      await this.run([
        '--git-dir', bareDir, '--work-tree', checkout,
        '-c', 'user.email=iac@aerekos.local',
        '-c', 'user.name=aerekos-iac',
        'commit', '-m', message, '--allow-empty',
      ]);
      const sha = await this.revParse(bareDir, `refs/heads/${branch}`);
      return { committed: true, path: filePath, sha, branch };
    } finally {
      try { fs.rmSync(checkout, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  async deleteFile(bareDir, {
    branch = 'main',
    filePath,
    message = 'delete file',
    baseSha,
  } = {}) {
    if (!this.enabled()) return { skipped: true };
    const rel = String(filePath || '').replace(/^\/+/, '');
    if (!rel) {
      const e = new Error('path is required');
      e.status = 400;
      throw e;
    }
    await this.assertBaseSha(bareDir, branch, baseSha);
    const os = require('os');
    const checkout = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-wt-'));
    try {
      await this.run(['--git-dir', bareDir, '--work-tree', checkout, 'checkout', '-f', branch]);
      const dest = path.join(checkout, rel);
      if (!fs.existsSync(dest)) {
        const e = new Error('file not found');
        e.status = 404;
        throw e;
      }
      await this.run(['--git-dir', bareDir, '--work-tree', checkout, 'rm', '-f', '--', rel]);
      await this.run([
        '--git-dir', bareDir, '--work-tree', checkout,
        '-c', 'user.email=iac@aerekos.local',
        '-c', 'user.name=aerekos-iac',
        'commit', '-m', message,
      ]);
      const sha = await this.revParse(bareDir, `refs/heads/${branch}`);
      return { deleted: true, path: rel, sha, branch };
    } finally {
      try { fs.rmSync(checkout, { recursive: true, force: true }); } catch { /* ignore */ }
    }
  }

  /**
   * Spawn git-upload-pack / git-receive-pack for Smart HTTP.
   * @param {'upload-pack'|'receive-pack'} service
   * @param {string} dir bare repo path
   * @param {{advertise?: boolean}} opts
   */
  spawnService(service, dir, { advertise = false, env } = {}) {
    const args = [service, '--stateless-rpc'];
    if (advertise) args.push('--advertise-refs');
    args.push(dir);
    return spawn(GIT_BIN, args, { env: env || process.env });
  }

  tarCreate(dir, outFile) {
    return new Promise((resolve, reject) => {
      execFile('tar', ['-C', path.dirname(dir), '-cf', outFile, path.basename(dir)], (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  tarExtract(archiveFile, destParent) {
    return new Promise((resolve, reject) => {
      execFile('tar', ['-C', destParent, '-xf', archiveFile], (err, stdout, stderr) => {
        if (err) {
          err.stderr = stderr;
          return reject(err);
        }
        resolve(stdout);
      });
    });
  }

  async createArchive(dir, outFile) {
    if (this.enabled()) {
      try {
        await this.run(['--git-dir', dir, 'bundle', 'create', outFile, '--all']);
        return 'bundle';
      } catch {
        /* empty repo: git refuses an empty bundle */
      }
    }
    await this.tarCreate(dir, outFile);
    return 'tar';
  }

  async restoreArchive(dir, archiveFile) {
    const head = fs.readFileSync(archiveFile).slice(0, 32).toString('utf8');
    const isBundle = head.startsWith('# v2 git bundle') || head.startsWith('# v3 git bundle');
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    if (isBundle && this.enabled()) {
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
      await this.run(['clone', '--mirror', archiveFile, dir]);
      await this.run(['--git-dir', dir, 'config', 'http.receivepack', 'true']);
      return 'bundle';
    }
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* ignore */ }
    await this.tarExtract(archiveFile, path.dirname(dir));
    return 'tar';
  }
}

module.exports = { GitService };

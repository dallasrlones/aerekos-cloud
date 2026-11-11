'use strict';

/**
 * yt-dlp runner for download_manager. Downloads a YouTube (or other
 * yt-dlp-supported) URL to a local temp dir as MP4 (or MP3), then the caller
 * streams the file into the target bucket.
 *
 * yt-dlp is the self-contained binary baked into the image (see
 * worker/scripts/standardize-dockerfiles.mjs); ffmpeg is present for muxing
 * and mp3 extraction.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp';

function buildArgs(url, { format = 'mp4', quality, outputDir }) {
  const out = path.join(outputDir, '%(title)s.%(ext)s');
  const base = ['-o', out, '--newline', '--no-part', '--restrict-filenames'];
  if (format === 'mp3') {
    base.push(
      '-x',
      '--audio-format', 'mp3',
      '--audio-quality', quality ? String(quality) : '192K',
      '--embed-metadata',
    );
  } else {
    // Prefer mp4 containers (video mp4 + audio m4a merged) so the result is a
    // single .mp4 that plays everywhere; fall back gracefully.
    base.push(
      '-f', 'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
      '--merge-output-format', 'mp4',
      '--embed-metadata',
    );
  }
  base.push(url);
  return base;
}

/**
 * Run yt-dlp.
 * @param {object} opts
 * @param {string} opts.url
 * @param {string} [opts.format] 'mp4' (default) or 'mp3'
 * @param {string} [opts.quality] mp3 bitrate (default 192K)
 * @param {string} [opts.outputDir] where to write (default: os tmp / aerekos-dm)
 * @param {number} [opts.timeoutMs] overall timeout (default 2h)
 * @param {(line:string)=>void} [opts.onProgress] called with raw yt-dlp stderr lines
 * @returns {Promise<{path: string, title: string}>} the output file path + title
 */
function runYtdlp({ url, format = 'mp4', quality, outputDir, timeoutMs = 2 * 60 * 60 * 1000, onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const dir = outputDir || path.join(os.tmpdir(), 'aerekos-dm');
    fs.mkdirSync(dir, { recursive: true });
    const args = buildArgs(url, { format, quality, outputDir: dir });

    let child;
    try {
      child = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(new Error(`failed to spawn ${YTDLP_BIN}: ${err.message}`));
    }

    let stderr = '';
    let stdout = '';
    let settled = false;

    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        reject(err);
      }
    };

    const timer = setTimeout(() => {
      finish(new Error(`yt-dlp timed out after ${Math.round(timeoutMs / 60000)}m for ${url}`));
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (onProgress) onProgress(d.toString());
    });
    child.stderr.on('data', (d) => {
      const s = d.toString();
      stderr += s;
      if (onProgress) onProgress(s);
    });

    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        finish(new Error(`${YTDLP_BIN} not found in container — rebuild the download_manager image (yt-dlp binary missing)`));
      } else {
        finish(err);
      }
    });

    child.on('close', (code) => {
      if (code === 0) {
        // Find the newest file in the output dir (yt-dlp wrote with a template name).
        let entries = [];
        try {
          entries = fs.readdirSync(dir).map((n) => ({ n, st: fs.statSync(path.join(dir, n)) }))
            .filter((e) => e.st.isFile());
        } catch { /* ignore */ }
        entries.sort((a, b) => b.st.mtimeMs - a.st.mtimeMs);
        if (!entries.length) {
          return finish(new Error(`yt-dlp exited 0 but wrote no file to ${dir} — ${stderr.slice(-300)}`));
        }
        const top = entries[0];
        const title = path.basename(top.n).replace(/\.[a-z0-9]+$/i, '');
        resolve({ path: path.join(dir, top.n), title, dir, format });
      } else {
        finish(new Error(`yt-dlp exited ${code}: ${(stderr || stdout).slice(-400)}`));
      }
    });
  });
}

/**
 * Search YouTube via yt-dlp (no API key needed).
 *
 * Runs `yt-dlp -J --flat-playlist "ytsearchN:query"` and returns the flat
 * result entries. This is the "own YouTube" search path — it is deliberately
 * separate from the torrent search so callers can treat the two engines
 * independently.
 *
 * @param {object} opts
 * @param {string} opts.query        search string
 * @param {number} [opts.max=10]     max results (clamped 1..50)
 * @param {number} [opts.timeoutMs=60000] overall timeout
 * @returns {Promise<{results: Array, source: 'youtube', engine: 'yt-dlp'}>}
 */
function searchYtdlp({ query, max = 10, timeoutMs = 60000 } = {}) {
  return new Promise((resolve, reject) => {
    const safe = String(query || '').replace(/[\r\n]/g, ' ').trim();
    if (!safe) return reject(new Error('search query is required'));
    const n = Math.max(1, Math.min(50, parseInt(max, 10) || 10));
    const args = ['-J', '--flat-playlist', `ytsearch${n}:${safe}`];

    let child;
    try {
      child = spawn(YTDLP_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) {
      return reject(new Error(`failed to spawn ${YTDLP_BIN}: ${err.message}`));
    }

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (err) {
        try { child.kill('SIGKILL'); } catch { /* ignore */ }
        reject(err);
      }
    };
    const timer = setTimeout(() => {
      finish(new Error(`yt-dlp search timed out after ${Math.round(timeoutMs / 1000)}s for "${safe}"`));
    }, timeoutMs);

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => {
      if (err.code === 'ENOENT') {
        finish(new Error(`${YTDLP_BIN} not found in container — rebuild the download_manager image (yt-dlp binary missing)`));
      } else {
        finish(err);
      }
    });
    child.on('close', (code) => {
      if (code === 0) {
        let j;
        try {
          j = JSON.parse(stdout);
        } catch {
          return finish(new Error(`yt-dlp search returned non-JSON: ${stdout.slice(0, 160)} ${stderr.slice(-160)}`));
        }
        const results = (j.entries || []).filter(Boolean).map((e) => ({
          id: e.id || null,
          url: e.url || (e.id ? `https://www.youtube.com/watch?v=${e.id}` : ''),
          title: e.title || '',
          duration: e.duration != null ? e.duration : null,
          channel: e.channel || e.channel_id || '',
          view_count: e.view_count != null ? e.view_count : null,
          thumbnail: e.thumbnail || null,
        }));
        resolve({ results, source: 'youtube', engine: 'yt-dlp' });
      } else {
        finish(new Error(`yt-dlp search exited ${code}: ${(stderr || stdout).slice(-300)}`));
      }
    });
  });
}

module.exports = { runYtdlp, searchYtdlp, buildArgs, YTDLP_BIN };

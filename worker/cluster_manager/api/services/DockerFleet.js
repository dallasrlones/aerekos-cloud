'use strict';

const { execFile } = require('child_process');

function execDocker(args) {
  return new Promise((resolve) => {
    execFile('docker', args, { timeout: 8000 }, (err, stdout, stderr) => {
      resolve({ ok: !err, stdout: String(stdout || ''), stderr: String(stderr || err?.message || '') });
    });
  });
}

async function listFleet() {
  if (process.env.SKIP_HOST_PATCH === '1' || process.env.SKIP_HOST_PATCH === 'true') {
    return { engine: 'docker', containers: [], skipped: true };
  }
  const r = await execDocker(['ps', '-a', '--format', '{{.ID}}\t{{.Names}}\t{{.Status}}\t{{.Image}}']);
  if (!r.ok) {
    return { engine: 'docker', containers: [], available: false, note: r.stderr.trim() || 'docker not available on this host' };
  }
  const containers = r.stdout.trim().split('\n').filter(Boolean).map((line) => {
    const [id, name, status, image] = line.split('\t');
    return { id, name, status, image };
  });
  return { engine: 'docker', available: true, containers };
}

module.exports = { listFleet };

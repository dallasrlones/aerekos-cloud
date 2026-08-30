'use strict';

const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const K3S_PATHS = ['/usr/local/bin/k3s', '/usr/bin/k3s'];
const KUBECTL_PATHS = ['/usr/local/bin/kubectl', '/usr/bin/kubectl'];

function isExecutable(p) {
  try {
    fs.accessSync(p, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function detectK3s() {
  const k3s = K3S_PATHS.find(isExecutable) || null;
  const kubectl = KUBECTL_PATHS.find(isExecutable) || null;
  return {
    installed: Boolean(k3s || kubectl),
    k3s_path: k3s,
    kubectl_path: kubectl,
  };
}

async function installK3s({ confirm } = {}) {
  if (confirm !== true) {
    const e = new Error('confirm===true required to install k3s');
    e.status = 400;
    throw e;
  }
  if (process.env.SKIP_HOST_PATCH === '1' || process.env.SKIP_HOST_PATCH === 'true') {
    return { skipped: true, reason: 'SKIP_HOST_PATCH' };
  }
  await execFileAsync(
    'nsenter',
    ['-t', '1', '-m', '-u', '-i', '-n', '--', 'sh', '-c', 'curl -sfL https://get.k3s.io | sh -'],
    { timeout: 180000 }
  );
  return { installed: true, ...detectK3s() };
}

module.exports = { detectK3s, installK3s };

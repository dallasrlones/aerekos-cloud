'use strict';

const fs = require('fs');
const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DOCKER_PACKAGES = [
  'docker-ce',
  'docker-ce-cli',
  'docker.io',
  'containerd.io',
  'docker-compose-plugin',
  'docker-ce-rootless-extras',
  'docker-buildx-plugin',
];

const OS_RELEASE_PATHS = [
  '/etc/os-release',
  '/usr/lib/os-release',
  '/host/etc/os-release',
  '/host/usr/lib/os-release',
];

function skipHostPatch() {
  const v = String(process.env.SKIP_HOST_PATCH || '').toLowerCase();
  return v === '1' || v === 'true';
}

function mockedProbe() {
  return {
    os: {
      supported: true,
      id: 'ubuntu',
      version: '24.04',
      pretty_name: 'Ubuntu 24.04 LTS (mock)',
      updates_available: 0,
      packages: [],
      reboot_required: false,
    },
    docker: {
      supported: true,
      version: '27.0.0',
      updates_available: 0,
      packages: [],
    },
    platform: process.platform,
    probed_at: new Date().toISOString(),
    mock: true,
  };
}

function parseOsRelease(text) {
  const out = {};
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[m[1]] = val;
  }
  return {
    id: out.ID || '',
    id_like: out.ID_LIKE || '',
    version: out.VERSION_ID || '',
    pretty_name: out.PRETTY_NAME || out.NAME || '',
    name: out.NAME || '',
  };
}

function readOsRelease() {
  for (const p of OS_RELEASE_PATHS) {
    try {
      if (fs.existsSync(p)) {
        return parseOsRelease(fs.readFileSync(p, 'utf8'));
      }
    } catch {
      // try next path
    }
  }
  return null;
}

function isDebianFamily(os) {
  if (!os) return false;
  const id = String(os.id || '').toLowerCase();
  const like = String(os.id_like || '').toLowerCase();
  return id === 'ubuntu' || id === 'debian' || like.includes('debian') || like.includes('ubuntu');
}

function aptPrefix() {
  try {
    if (fs.existsSync('/host/usr/bin/apt-get') || fs.existsSync('/host/usr/bin/apt')) {
      return ['chroot', '/host'];
    }
  } catch {
    // fall through
  }
  return [];
}

async function runCmd(file, args, opts = {}) {
  const { stdout, stderr } = await execFileAsync(file, args, {
    timeout: opts.timeout || 60000,
    maxBuffer: 12 * 1024 * 1024,
    env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' },
  });
  return { stdout: String(stdout || ''), stderr: String(stderr || '') };
}

function parseAptListUpgradable(text) {
  const packages = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^([^/\s]+)\/\S+\s+(\S+)\s+\S+\s+\[upgradable from:\s*([^\]]+)\]/i);
    if (!m) continue;
    packages.push({
      name: m[1],
      candidate: m[2],
      current: m[3],
    });
  }
  return packages;
}

function parseAptGetSimulate(text) {
  const packages = [];
  for (const line of String(text || '').split('\n')) {
    const m = line.match(/^Inst\s+(\S+)(?:\s+\[([^\]]+)\])?(?:\s+\(([^) ]+))?/);
    if (!m) continue;
    packages.push({
      name: m[1],
      current: m[2] || '',
      candidate: m[3] || '',
    });
  }
  return packages;
}

function isDockerPackage(name) {
  const n = String(name || '').toLowerCase();
  return DOCKER_PACKAGES.includes(n) || n.startsWith('docker-');
}

function rebootRequired() {
  const paths = ['/var/run/reboot-required', '/host/var/run/reboot-required'];
  for (const p of paths) {
    try {
      if (fs.existsSync(p)) return true;
    } catch {
      // continue
    }
  }
  return false;
}

function getDocker() {
  const Docker = require('dockerode');
  return new Docker({
    socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  });
}

async function dockerVersion(docker) {
  try {
    const info = await docker.version();
    return (
      info?.Version ||
      info?.Server?.Version ||
      info?.Components?.find((c) => c.Name === 'Engine')?.Version ||
      null
    );
  } catch {
    try {
      const { stdout } = await runCmd('docker', ['version', '--format', '{{.Server.Version}}'], {
        timeout: 10000,
      });
      const v = String(stdout || '').trim();
      return v || null;
    } catch {
      return null;
    }
  }
}

async function isMacDockerDesktop(docker) {
  if (process.platform === 'darwin') return true;
  try {
    const info = await docker.info();
    const blob = [info.OperatingSystem, info.OSType, info.Name, info.KernelVersion]
      .filter(Boolean)
      .join(' ');
    if (/docker desktop/i.test(blob) || /docker-desktop/i.test(String(info.Name || ''))) {
      return true;
    }
  } catch {
    // daemon unavailable — not enough to call this Docker Desktop
  }
  return false;
}

async function listUpgradable() {
  const prefix = aptPrefix();
  const file = prefix[0] || 'apt';
  const base = prefix[0] ? prefix.slice(1) : [];

  try {
    const listArgs = prefix[0]
      ? [...base, 'apt', 'list', '--upgradable']
      : ['list', '--upgradable'];
    const { stdout } = await runCmd(file, listArgs, { timeout: 90000 });
    const packages = parseAptListUpgradable(stdout);
    if (packages.length || /listing/i.test(stdout)) return packages;
  } catch {
    // fall through to apt-get -s
  }

  try {
    const simArgs = prefix[0]
      ? [...base, 'apt-get', '-s', '-o', 'Debug::NoLocking=true', 'upgrade']
      : ['-s', '-o', 'Debug::NoLocking=true', 'upgrade'];
    const simFile = prefix[0] ? file : 'apt-get';
    const { stdout } = await runCmd(simFile, simArgs, { timeout: 90000 });
    return parseAptGetSimulate(stdout);
  } catch (err) {
    const error = new Error(`Failed to list upgradable packages: ${err.message}`);
    error.cause = err;
    throw error;
  }
}

async function probe() {
  if (skipHostPatch()) return mockedProbe();

  const probed_at = new Date().toISOString();
  const osRelease = readOsRelease();
  let docker;
  try {
    docker = getDocker();
  } catch {
    docker = null;
  }

  if (await isMacDockerDesktop(docker)) {
    return {
      os: {
        supported: false,
        reason: 'macOS Docker Desktop is not supported for host OS updates',
        pretty_name: osRelease?.pretty_name || 'macOS',
        updates_available: 0,
        packages: [],
        reboot_required: false,
      },
      docker: {
        supported: false,
        reason: 'macOS Docker Desktop is not supported for Docker engine updates',
        version: docker ? await dockerVersion(docker) : null,
        updates_available: 0,
        packages: [],
      },
      platform: process.platform === 'darwin' ? 'darwin' : 'docker-desktop',
      probed_at,
    };
  }

  const debian = isDebianFamily(osRelease);
  let packages = [];
  let listError = null;
  if (debian) {
    try {
      packages = await listUpgradable();
    } catch (err) {
      listError = err.message;
    }
  }

  const osPackages = packages.filter((p) => !isDockerPackage(p.name));
  const dockerPackages = packages.filter((p) => isDockerPackage(p.name));
  const version = docker ? await dockerVersion(docker) : null;

  const os = debian
    ? {
        supported: true,
        id: osRelease.id,
        version: osRelease.version,
        pretty_name: osRelease.pretty_name,
        updates_available: osPackages.length,
        packages: osPackages,
        reboot_required: rebootRequired(),
        ...(listError ? { warning: listError } : {}),
      }
    : {
        supported: false,
        reason: osRelease
          ? `Only Debian/Ubuntu apt hosts are supported (detected: ${osRelease.pretty_name || osRelease.id || 'unknown'})`
          : 'Unable to read /etc/os-release (or /host/etc/os-release)',
        id: osRelease?.id || null,
        version: osRelease?.version || null,
        pretty_name: osRelease?.pretty_name || null,
        updates_available: 0,
        packages: [],
        reboot_required: rebootRequired(),
      };

  return {
    os,
    docker: {
      supported: debian,
      reason: debian ? undefined : 'Docker package updates require a Debian/Ubuntu apt host',
      version,
      updates_available: dockerPackages.length,
      packages: dockerPackages,
    },
    platform: process.platform,
    probed_at,
  };
}

function decodeDockerLogs(raw) {
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw || '');
  if (!buffer.length) return '';
  let out = '';
  let offset = 0;
  let multiplexed = true;
  while (offset + 8 <= buffer.length) {
    const streamType = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    if (streamType > 2 || offset + 8 + size > buffer.length) {
      multiplexed = false;
      break;
    }
    out += buffer.slice(offset + 8, offset + 8 + size).toString('utf8');
    offset += 8 + size;
  }
  if (multiplexed && offset === buffer.length) return out;
  return buffer.toString('utf8');
}

async function ensureImage(docker, image) {
  try {
    await docker.getImage(image).inspect();
    return;
  } catch {
    await new Promise((resolve, reject) => {
      docker.pull(image, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, (e) => (e ? reject(e) : resolve()));
      });
    });
  }
}

function osUpgradeScript() {
  return [
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update -y',
    'apt-get upgrade -y',
    'if [ -f /var/run/reboot-required ]; then echo __AEREKOS_REBOOT_REQUIRED=1; else echo __AEREKOS_REBOOT_REQUIRED=0; fi',
  ].join('\n');
}

function dockerUpgradeScript() {
  const pkgs = DOCKER_PACKAGES.map((p) => `'${p}'`).join(' ');
  return [
    'set -e',
    'export DEBIAN_FRONTEND=noninteractive',
    'apt-get update -y',
    `PKGS=""`,
    `for p in ${pkgs}; do`,
    '  if dpkg -s "$p" >/dev/null 2>&1; then PKGS="$PKGS $p"; fi',
    'done',
    'if [ -z "$PKGS" ]; then',
    '  echo __AEREKOS_NO_DOCKER_PKGS=1',
    'else',
    '  # shellcheck disable=SC2086',
    '  apt-get install -y --only-upgrade $PKGS',
    'fi',
    'if [ -f /var/run/reboot-required ]; then echo __AEREKOS_REBOOT_REQUIRED=1; else echo __AEREKOS_REBOOT_REQUIRED=0; fi',
  ].join('\n');
}

async function runPrivilegedHostCommand(script) {
  const docker = getDocker();
  const image = process.env.HOST_PATCH_IMAGE || 'alpine:3.20';
  await ensureImage(docker, image);

  const container = await docker.createContainer({
    Image: image,
    Cmd: ['nsenter', '-t', '1', '-m', '-u', '-n', '-i', 'sh', '-c', script],
    HostConfig: {
      Privileged: true,
      PidMode: 'host',
      NetworkMode: 'host',
      AutoRemove: false,
    },
    Tty: true,
    Labels: {
      'aerekos.managed': 'true',
      'aerekos.host-patch': 'true',
    },
  });

  try {
    await container.start();
    const result = await container.wait();
    const rawLogs = await container.logs({ stdout: true, stderr: true });
    const output = decodeDockerLogs(rawLogs);
    return {
      exitCode: result.StatusCode,
      output,
    };
  } finally {
    await container.remove({ force: true }).catch(() => {});
  }
}

async function update({ target } = {}) {
  if (target !== 'os' && target !== 'docker') {
    const err = new Error("target must be 'os' or 'docker'");
    err.status = 400;
    throw err;
  }

  if (skipHostPatch()) {
    return {
      ok: true,
      skipped: true,
      target,
      reboot_required: false,
      message: 'SKIP_HOST_PATCH: update not executed',
    };
  }

  const current = await probe();
  const part = target === 'os' ? current.os : current.docker;
  if (!part || part.supported === false) {
    const err = new Error(part?.reason || `${target} updates are not supported on this host`);
    err.status = 400;
    err.probe = current;
    throw err;
  }

  const script = target === 'os' ? osUpgradeScript() : dockerUpgradeScript();
  const { exitCode, output } = await runPrivilegedHostCommand(script);
  const reboot_required =
    /__AEREKOS_REBOOT_REQUIRED=1/.test(output) || rebootRequired();

  if (exitCode !== 0) {
    const err = new Error(`Host ${target} update failed (exit ${exitCode})`);
    err.status = 500;
    err.output = output;
    err.reboot_required = reboot_required;
    throw err;
  }

  let after = null;
  try {
    after = await probe();
  } catch {
    after = null;
  }

  return {
    ok: true,
    target,
    reboot_required,
    output,
    after,
    message: reboot_required
      ? `${target} update completed; reboot required (not performed)`
      : `${target} update completed`,
  };
}

module.exports = {
  probe,
  check: probe,
  update,
  mockedProbe,
  parseAptListUpgradable,
  parseAptGetSimulate,
  parseOsRelease,
  isDebianFamily,
};

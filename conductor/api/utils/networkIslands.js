'use strict';

function parseIpv4(ip) {
  const parts = String(ip || '').split('.');
  if (parts.length !== 4) return null;
  const nums = parts.map((p) => Number(p));
  if (nums.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return ((nums[0] << 24) >>> 0) + (nums[1] << 16) + (nums[2] << 8) + nums[3];
}

function sameIsland(ipA, ipB, prefix = 24) {
  const a = parseIpv4(ipA);
  const b = parseIpv4(ipB);
  if (a == null || b == null) return false;
  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0);
  return (a & mask) === (b & mask);
}

function overlayIp(worker) {
  if (!worker) return null;
  if (worker.overlay_ip) return worker.overlay_ip;
  let res = worker.resources;
  if (typeof res === 'string') {
    try { res = JSON.parse(res); } catch { res = {}; }
  }
  return res?.overlay_ip || res?.tailscale_ip || null;
}

function classifyWorker(worker, peers = [], conductorIp = null) {
  const ip = worker?.ip_address || '';
  const sameAsConductor = conductorIp ? sameIsland(ip, conductorIp) : false;
  const sameAsPeer = (peers || []).some((p) => p && p.id !== worker?.id && sameIsland(ip, p.ip_address));
  const island = sameAsConductor || sameAsPeer ? 'lan' : 'remote';
  return {
    worker_id: worker?.id,
    ip_address: ip,
    overlay_ip: overlayIp(worker),
    island,
    same_lan_as_conductor: sameAsConductor,
    prefer_lan: island === 'lan',
  };
}

function classifyFleet(workers = [], conductorIp = process.env.CONDUCTOR_LAN_IP || '192.168.0.141') {
  return (workers || []).map((w) => classifyWorker(w, workers, conductorIp));
}

function workerReachUrls(worker, port, { probeOk = true } = {}) {
  const urls = [];
  const classified = classifyWorker(worker, [], process.env.CONDUCTOR_LAN_IP || '192.168.0.141');
  if (classified.prefer_lan && probeOk !== false && worker.ip_address) {
    urls.push(`http://${worker.ip_address}:${port}`);
  }
  const ov = classified.overlay_ip;
  if (ov) urls.push(`http://${ov}:${port}`);
  const host = worker.hostname;
  if (host) urls.push(`http://${host}.aerekos.internal:${port}`);
  if (!classified.prefer_lan && worker.ip_address) {
    urls.push(`http://${worker.ip_address}:${port}`);
  }
  return urls;
}

module.exports = {
  parseIpv4,
  sameIsland,
  overlayIp,
  classifyWorker,
  classifyFleet,
  workerReachUrls,
};

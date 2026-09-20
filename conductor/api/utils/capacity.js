'use strict';

const os = require('os');

const DEFAULT_RESERVE_GB = Number(process.env.AEREKOS_RAM_RESERVE_GB || 8);

function bytesToGb(n) {
  return Number(n || 0) / (1024 * 1024 * 1024);
}

function estimateModelGb({ diskGb, paramsB, quant } = {}) {
  if (diskGb != null && Number(diskGb) > 0) return Number(diskGb) * 1.15;
  const params = Number(paramsB || 0);
  if (!params) return 4;
  const q = String(quant || '').toLowerCase();
  let bytesPer = 2;
  if (q.includes('4') || q.includes('awq') || q.includes('gptq')) bytesPer = 0.55;
  else if (q.includes('8') || q.includes('q8')) bytesPer = 1;
  else if (q.includes('fp16') || q.includes('half')) bytesPer = 2;
  return params * bytesPer + 4;
}

function canFit({ totalGb, usedGb, requestGb, reserveGb = DEFAULT_RESERVE_GB, already = [] } = {}) {
  const total = Number(totalGb || 0);
  const used = Number(usedGb || 0);
  const request = Number(requestGb || 0);
  const reserve = Number(reserveGb || 0);
  const free = Math.max(0, total - used);
  const ok = request <= 0 || free - reserve >= request;
  return {
    ok,
    code: ok ? 'ok' : 'INSUFFICIENT_MEMORY',
    total_gb: Math.round(total * 10) / 10,
    used_gb: Math.round(used * 10) / 10,
    free_gb: Math.round(free * 10) / 10,
    reserve_gb: Math.round(reserve * 10) / 10,
    request_gb: Math.round(request * 10) / 10,
    remaining_if_ok: Math.round((free - reserve - request) * 10) / 10,
    already: already || [],
  };
}

function canFitLocal({ requestGb, reserveGb } = {}) {
  const total = bytesToGb(os.totalmem());
  const free = bytesToGb(os.freemem());
  return canFit({ totalGb: total, usedGb: Math.max(0, total - free), requestGb, reserveGb });
}

function insufficientError(fit, extra = {}) {
  const e = new Error(
    `not enough memory on this host: ${fit.free_gb} GB free, need ${fit.request_gb} GB (+ ${fit.reserve_gb} GB reserve)`
      + (fit.already?.length ? `; already loaded: ${fit.already.join(', ')}` : '')
  );
  e.status = 409;
  e.code = 'INSUFFICIENT_MEMORY';
  e.capacity = { ...fit, ...extra };
  return e;
}

module.exports = { DEFAULT_RESERVE_GB, estimateModelGb, canFit, canFitLocal, insufficientError, bytesToGb };

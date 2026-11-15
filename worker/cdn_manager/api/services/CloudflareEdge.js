'use strict';

const axios = require('axios');

function token() {
  return process.env.CLOUDFLARE_API_TOKEN || '';
}

function zone() {
  return process.env.CLOUDFLARE_ZONE_ID || '';
}

/**
 * Live purge against Cloudflare when token + zone are set.
 * Missing credentials → honest { purged: false } (not a mock success).
 */
async function purge({ prefixes, hosts, tags } = {}) {
  if (!token() || !zone()) {
    return { purged: false, reason: 'cloudflare token or zone missing' };
  }
  const { data } = await axios.post(
    `https://api.cloudflare.com/client/v4/zones/${zone()}/purge_cache`,
    { prefixes, hosts, tags, purge_everything: !prefixes && !hosts && !tags },
    { headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' } },
  );
  return { purged: !!data.success, errors: data.errors || [] };
}

/**
 * Cache Rules API write is parked (EDGE-PRO-4a). Never claim applied:true without a live call.
 */
async function putCacheRule({ name, expression, edge_ttl_seconds }) {
  if (!token() || !zone()) {
    return { applied: false, reason: 'cloudflare token or zone missing' };
  }
  return {
    applied: false,
    parked: true,
    name,
    expression,
    edge_ttl_seconds,
    reason: 'CF Cache Rulesets write not implemented (EDGE-PRO-4a); use dashboard until wired',
  };
}

/**
 * WAF/Access stay on the Cloudflare account. Intent-only — never fake applied:true.
 */
async function putWafNote({ name, rate_limit }) {
  return {
    applied: false,
    parked: true,
    name,
    rate_limit: rate_limit || 60,
    reason: 'WAF/Access remain on Cloudflare account; this records intent only (EDGE-PRO)',
  };
}

module.exports = { purge, putCacheRule, putWafNote };

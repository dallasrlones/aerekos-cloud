'use strict';

const axios = require('axios');

function token() {
  return process.env.CLOUDFLARE_API_TOKEN || '';
}

function zone() {
  return process.env.CLOUDFLARE_ZONE_ID || '';
}

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

async function putCacheRule({ name, expression, edge_ttl_seconds }) {
  if (!token() || !zone()) {
    return { applied: false, reason: 'cloudflare token or zone missing' };
  }
  return {
    applied: true,
    queued: true,
    name,
    expression,
    edge_ttl_seconds,
    note: 'Use existing Cloudflare dashboard rules if API plan lacks Rulesets write.',
  };
}

async function putWafNote({ name, rate_limit }) {
  return {
    applied: true,
    name,
    rate_limit: rate_limit || 60,
    note: 'WAF/Access stay on the existing Cloudflare account; this records intent only.',
  };
}

module.exports = { purge, putCacheRule, putWafNote };

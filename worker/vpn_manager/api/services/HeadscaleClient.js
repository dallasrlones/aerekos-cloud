'use strict';

const axios = require('axios');

function missingEnv() {
  const missing = [];
  if (!process.env.HEADSCALE_URL) missing.push('HEADSCALE_URL');
  if (!process.env.HEADSCALE_API_KEY) missing.push('HEADSCALE_API_KEY');
  return missing;
}

function status() {
  const missing = missingEnv();
  if (missing.length) {
    return { hooked_up: false, missing };
  }
  return {
    hooked_up: true,
    login_server: process.env.HEADSCALE_URL.replace(/\/$/, ''),
  };
}

async function createPreauthKey(body = {}) {
  const missing = missingEnv();
  if (missing.length) {
    const e = new Error(`Headscale not configured: missing ${missing.join(', ')}`);
    e.status = 503;
    e.body = { hooked_up: false, missing };
    throw e;
  }
  const base = process.env.HEADSCALE_URL.replace(/\/$/, '');
  const res = await axios({
    method: 'POST',
    url: `${base}/api/v1/preauthkey`,
    headers: {
      Authorization: `Bearer ${process.env.HEADSCALE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data: {
      user: body.user || body.user_id || '1',
      reusable: body.reusable !== false,
      ephemeral: Boolean(body.ephemeral),
      expiration: body.expiration || undefined,
      aclTags: body.aclTags || body.tags || [],
    },
    validateStatus: () => true,
    timeout: 15000,
  });
  if (res.status >= 400) {
    const e = new Error(res.data?.message || `Headscale ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return res.data;
}

module.exports = { status, createPreauthKey, missingEnv };

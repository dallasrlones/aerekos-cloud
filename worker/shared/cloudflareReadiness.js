'use strict';

/**
 * Cloudflare configuration readiness for edge managers (tunnel, domain, cdn).
 */

function isSkip() {
  const skip = process.env.SKIP_CLOUDFLARE === '1' || process.env.SKIP_CLOUDFLARE === 'true';
  if (skip && process.env.NODE_ENV === 'production') {
    throw new Error('SKIP_CLOUDFLARE cannot be enabled when NODE_ENV=production');
  }
  return skip;
}

function checkConfig() {
  if (isSkip()) {
    if (process.env.NODE_ENV === 'production') {
      const err = new Error('SKIP_CLOUDFLARE is forbidden when NODE_ENV=production');
      err.code = 'SKIP_CLOUDFLARE_PROD';
      throw err;
    }
    return {
      ready: true,
      mode: 'mock',
      message: 'SKIP_CLOUDFLARE enabled — using mock Cloudflare responses',
    };
  }
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const missing = [];
  if (!token) missing.push('CLOUDFLARE_API_TOKEN');
  if (!accountId) missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (missing.length) {
    return {
      ready: false,
      mode: 'live',
      missing,
      message: `Store secrets cloudflare_api_token and cloudflare_account_id, then enable the service`,
    };
  }
  return {
    ready: true,
    mode: 'live',
    message: 'Cloudflare credentials configured',
  };
}

module.exports = { isSkip, checkConfig };

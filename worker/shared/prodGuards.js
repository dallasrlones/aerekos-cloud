'use strict';

const DUMMY_JWT = [
  'change-this-secret-in-production',
  'change-me-in-production',
  'change-me',
  'your-token-secret-change-this-in-production',
];

const DUMMY_SIGNED = [
  'change-this-secret-key-in-production',
];

const ZERO_KEY = /^0+$/;

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function die(msg) {
  console.error(msg);
  process.exit(1);
}

function assertNoSkipFakes({ extra = [] } = {}) {
  if (!isProduction()) return;
  const flags = [
    'SKIP_DOCKER',
    'SKIP_CLOUDFLARE',
    'SKIP_INVOKE',
    'SKIP_DOWNLOAD',
    'SKIP_HEALTH',
    'SKIP_HOST_PATCH',
    ...extra,
  ];
  for (const f of flags) {
    const v = String(process.env[f] || '').toLowerCase();
    if (v === '1' || v === 'true') {
      die(`[prod] ${f} is set — refusing to start in NODE_ENV=production`);
    }
  }
  if (String(process.env.MOCK_KEY_MANAGER || '').toLowerCase() === 'true') {
    die('[prod] MOCK_KEY_MANAGER cannot be enabled when NODE_ENV=production');
  }
}

function assertNoDummySecret(name, value, { also = [] } = {}) {
  if (!isProduction()) return;
  const v = String(value || '').trim();
  if (!v) die(`[prod] ${name} must be set when NODE_ENV=production`);
  const banned = [...DUMMY_JWT, ...DUMMY_SIGNED, ...also];
  if (banned.includes(v)) die(`[prod] ${name} is still a documented dummy value`);
  if (ZERO_KEY.test(v) && v.length >= 16) die(`[prod] ${name} looks like an all-zero dummy key`);
}

function assertProdSecrets() {
  if (!isProduction()) return;
  assertNoDummySecret('JWT_SECRET', process.env.JWT_SECRET);
  if (process.env.TOKEN_SECRET !== undefined) {
    assertNoDummySecret('TOKEN_SECRET', process.env.TOKEN_SECRET);
  }
  if (process.env.SIGNED_URL_SECRET !== undefined) {
    assertNoDummySecret('SIGNED_URL_SECRET', process.env.SIGNED_URL_SECRET);
  }
  const master = process.env.KEY_MANAGER_MASTER_KEY || process.env.MASTER_KEY;
  if (master !== undefined) {
    assertNoDummySecret('KEY_MANAGER_MASTER_KEY', master);
  }
}

module.exports = {
  isProduction,
  assertNoSkipFakes,
  assertNoDummySecret,
  assertProdSecrets,
};

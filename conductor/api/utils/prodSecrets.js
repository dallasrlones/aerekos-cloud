'use strict';

const DUMMY = [
  'change-this-secret-in-production',
  'change-me-in-production',
  'change-me',
  'your-token-secret-change-this-in-production',
  'change-this-secret-key-in-production',
];

function assertProdSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const jwt = String(process.env.JWT_SECRET || '').trim();
  if (!jwt || DUMMY.includes(jwt)) {
    throw new Error('JWT_SECRET must be set to a non-dummy value when NODE_ENV=production');
  }
  const token = String(process.env.TOKEN_SECRET || '').trim();
  if (!token || DUMMY.includes(token)) {
    throw new Error('TOKEN_SECRET must be set to a non-dummy value when NODE_ENV=production');
  }
}

module.exports = { assertProdSecrets };

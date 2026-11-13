'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function dataDir() {
  return process.env.CONDUCTOR_DATA_DIR
    || process.env.DATA_DIR
    || path.join(__dirname, '../../data');
}

function identityPath() {
  return path.join(dataDir(), 'federation-peer-identity.json');
}

function publicBaseUrl() {
  const raw = process.env.PUBLIC_API_URL
    || process.env.CONDUCTOR_PUBLIC_URL
    || process.env.CONDUCTOR_URL
    || 'http://127.0.0.1:4700';
  return String(raw).replace(/\/$/, '');
}

class PeerIdentityService {
  constructor() {
    this._cache = null;
  }

  ensure() {
    if (this._cache) return this._cache;
    const file = identityPath();
    try {
      if (fs.existsSync(file)) {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8'));
        if (raw?.peer_id && raw?.private_key && raw?.public_key) {
          this._cache = raw;
          return this._cache;
        }
      }
    } catch (err) {
      console.warn('[PeerIdentity] load failed, reminting:', err.message);
    }
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');
    const peer_id = crypto.randomBytes(16).toString('hex');
    const record = {
      peer_id,
      private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }),
      public_key: publicKey.export({ type: 'spki', format: 'pem' }),
      created_at: new Date().toISOString(),
    };
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(record, null, 2), { mode: 0o600 });
    } catch (err) {
      console.warn('[PeerIdentity] persist failed (in-memory only):', err.message);
    }
    this._cache = record;
    return this._cache;
  }

  getPeerCard(label) {
    const id = this.ensure();
    return {
      peer_id: id.peer_id,
      public_key: id.public_key,
      base_url: publicBaseUrl(),
      label: label || process.env.CONDUCTOR_PEER_LABEL || 'conductor',
      status: 'active',
    };
  }

  getPrivateKeyPem() {
    return this.ensure().private_key;
  }

  getPeerId() {
    return this.ensure().peer_id;
  }
}

module.exports = new PeerIdentityService();

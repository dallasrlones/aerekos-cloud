const { randomUUID } = require('crypto');
const { CloudflareDnsClient } = require('./CloudflareDnsClient');

class ZoneService {
  constructor(deps = {}) {
    this.client = deps.client || new CloudflareDnsClient();
  }

  isSkip() {
    return process.env.SKIP_CLOUDFLARE === '1' || process.env.SKIP_CLOUDFLARE === 'true';
  }

  async listZones({ accountId } = {}) {
    if (this.isSkip()) {
      return [
        {
          id: `zone-mock-${randomUUID().slice(0, 8)}`,
          name: 'aerekos.example.com',
          status: 'active',
          account: { id: accountId || process.env.CLOUDFLARE_ACCOUNT_ID || 'mock-account' },
        },
      ];
    }
    const zones = await this.client.listZones({
      accountId: accountId || process.env.CLOUDFLARE_ACCOUNT_ID,
    });
    return zones.map((z) => ({
      id: z.id,
      name: z.name,
      status: z.status,
      account: z.account,
    }));
  }
}

module.exports = { ZoneService };

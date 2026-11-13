'use strict';

/**
 * Edge DNS / tunnel provider seam — Cloudflare default; Route53 / Cloud DNS stubs.
 * @see docs/architecture/edge-providers.md
 */

const KINDS = ['cloudflare', 'route53', 'gcp_dns'];

function resolveEdgeProviderKind(explicit) {
  const raw =
    explicit ||
    process.env.AEREKOS_EDGE_PROVIDER ||
    process.env.AEREKOS_DNS_PROVIDER ||
    'cloudflare';
  const k = String(raw).toLowerCase();
  return KINDS.includes(k) ? k : 'cloudflare';
}

/**
 * @typedef {object} TunnelProvider
 * @property {(accountId: string, opts: { name: string }) => Promise<unknown>} createTunnel
 * @property {(accountId: string, tunnelId: string) => Promise<unknown>} getTunnel
 * @property {(accountId: string, tunnelId: string, config: unknown) => Promise<unknown>} putConfig
 */

/**
 * @typedef {object} DnsProvider
 * @property {(zoneId: string, record: unknown) => Promise<unknown>} upsertRecord
 * @property {(zoneId: string, recordId: string) => Promise<void>} deleteRecord
 * @property {(accountId: string) => Promise<unknown[]>} listZones
 */

class EdgeProvider {
  /** @param {'cloudflare'|'route53'|'gcp_dns'} kind */
  constructor(kind) {
    this.kind = kind;
  }

  describe() {
    return { kind: this.kind, implemented: this.kind === 'cloudflare' };
  }

  /**
   * @returns {{ tunnel: TunnelProvider, dns: DnsProvider, kind: string }}
   */
  static create(kind) {
    const resolved = resolveEdgeProviderKind(kind);
    if (resolved === 'cloudflare') {
      return {
        kind: resolved,
        tunnel: null,
        dns: null,
        note: 'Wire CloudflareTunnelClient / CloudflareDnsClient in tunnel_manager and domain_manager',
      };
    }
    const e = new Error(`edge provider "${resolved}" is not implemented`);
    e.code = 'EdgeProviderNotImplemented';
    e.status = 501;
    throw e;
  }
}

module.exports = {
  KINDS,
  resolveEdgeProviderKind,
  EdgeProvider,
};

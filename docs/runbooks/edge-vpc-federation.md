# Edge, VPC, and federation (GA story)

## VPN / mesh

- Headscale / Tailscale: [headscale.md](./headscale.md) · ADR [002-fleet-vpc-headscale.md](../adr/002-fleet-vpc-headscale.md)
- Project docker networks via `network_manager` — not a full cloud VPC

## Federation / friends

- Limits and preview labels: [friends_federation.md](../plans/friends_federation.md)
- E2e: `e2e/friends-federation.js` (sandbox cleanup)

## Cloudflare

API tokens and tunnel credentials **only** via `secrets_manager` — never commit tokens. Edge hookup e2e: `e2e/wave-edge-hookup.js`.

## ACL isolation

Cross-project isolation shares the W19 suite: `e2e/wave-tenancy-isolation.js`.

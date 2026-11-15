# Conductor e2e

In-process coverage: `npm test` / `npm run test:unit` / `npm run test:integration`
(health/ready, appProxyAuth, proxyAuthorization, isLivenessPath, proxy suites).

**Live fleet e2e:** parked with `ops-gate0` (cloud 530 + Cloudflare SSH handshake fail
2026-11-15). Retry when tunnel/LAN is up; do not block Wave 9 control-plane closeout.

Do not target production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7`.

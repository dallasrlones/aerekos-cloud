# Edge & storage — pro production stack

> **Status:** Planned — elevates storage + Cloudflare edge to AWS/GCP bar  
> **Navigation:** [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [vpc_network.md](./vpc_network.md) · [service_setup_wizard.md](./service_setup_wizard.md)

---

## Scope (“and all that”)

| Service | AWS analog | Pro target |
|---------|------------|------------|
| [storage_manager](./storage_manager.md) | S3 | Full object-store ops + app-access |
| [tunnel_manager](./tunnel_manager.md) | Cloudflare Tunnel | Live CF API + cloudflared orchestration |
| [domain_manager](./domain_manager.md) | Route 53 | Live DNS + zone discovery |
| [cdn_manager](./cdn_manager.md) | CloudFront | CF cache rules + purge |
| [balancer_manager](./balancer_manager.md) | ELB | Health-checked targets → compute |
| [registry_manager](./registry_manager.md) | ECR | Pull secrets + registry metadata (runtime later) |
| [api_manager](./api_manager.md) | API Gateway | Pretty invoke URLs → tunnel origin `cloudapi` |
| [webhook_manager](./webhook_manager.md) | — | Inbound hooks via tunnel + HMAC (E41) |

**Depends on:** `key_manager` → `secrets_manager` (CF token, signing keys) — setup wizard order.

**Not in this stack (still deferred):** email, sms, slack, crawler.

---

## Locked edge decisions

| Decision | Choice |
|----------|--------|
| DNS + tunnel provider | **Cloudflare** (already in code) |
| CF credentials | **secrets_manager** — `cloudflare.api_token`, `cloudflare.account_id`; never git |
| Public ingress | **Cloudflare Tunnel** (north-south) + **Headscale** (east-west private) |
| Split origins | UI → `:19006`; API → conductor `:3300`; manager direct hosts via `SERVICE_DIRECT_HOSTS` |
| Prod hostnames | `cloud.aerekos.com`, `cloudapi.aerekos.com` — managed via domain + tunnel wizards |
| cloudflared | Conductor deploys connector config per tunnel row; token shown once in UI |
| SKIP_CLOUDFLARE | Tests/CI only — prod must use live API |
| Zero Trust | **CF Access** for admin SSH/console paths — separate token from tunnel API |
| WAF | Rate limit + bot protection on `cloud` / `cloudapi` at CF edge |

---

## Cloudflare Zero Trust + WAF (EDGE-PRO-7) — pro-edge-7

> Separate from tunnel API token. See [provision-cf-service-token.sh](../../scripts/deploy/provision-cf-service-token.sh) for SSH Access.

- [ ] **pro-edge-7a** Store `cloudflare.access` service token in secrets_manager (SSH/admin)
- [ ] **pro-edge-7b** CF Access application for admin paths (console admin, Headscale UI if exposed)
- [ ] **pro-edge-7c** WAF custom rules: rate limit `POST /api/auth/login`, `/auth/token`
- [ ] **pro-edge-7d** Bot Fight Mode / managed ruleset on public zones
- [ ] **pro-edge-7e** Document token scope matrix: Tunnel vs DNS vs Cache vs Access
- [ ] **pro-edge-7f** HSTS + security headers (E29) via CF transform rules
- [ ] **pro-edge-7g** Runbook: rotate Access vs API tokens independently

**Minimum Access token permissions:** Access → Service Tokens: Edit; Access → Applications: Edit

---

## Unified “Public hostname” wizard (best practice)

One console flow ties edge services (like AWS CloudFront + Route 53 + ALB setup):

```
1. Connect Cloudflare (secrets_manager probe)
2. Pick zone (domain_manager list zones)
3. Create tunnel (tunnel_manager) → show token once + auto cloudflared hint
4. Create DNS record → CNAME to tunnel (domain_manager)
5. Optional: cache rule (cdn_manager)
6. Optional: origin = conductor :3300 / frontend :19006
7. Test: curl https://newhost.aerekos.com/health
```

CLI: `aerekos edge hostname create --project $PID --host api.example.com --origin http://conductor:3300`

---

## Cloudflare bootstrap (EDGE-PRO-0) — pro-edge-0

- [ ] **pro-edge-0a** Secrets: `cloudflare.api_token`, `cloudflare.account_id` in secrets_manager
- [ ] **pro-edge-0b** Conductor injects into tunnel/domain/cdn via env ref (not plaintext in compose)
- [ ] **pro-edge-0c** Setup wizard: “Connect Cloudflare” with probe `GET zones`
- [ ] **pro-edge-0d** Readiness probe on tunnel_manager `/ready` — live CF or clear misconfig
- [ ] **pro-edge-0e** Runbook: rotate token, minimum API token permissions (scoped)
- [ ] **pro-edge-0f** ops-pre-2: store tokens before pro-edge-1 automation
- [ ] **ops-pre-5** Document + import manual prod tunnels → tunnel_manager DB (after pro-edge-1)

**Minimum CF token permissions:**
- Account → Cloudflare Tunnel: Edit
- Zone → DNS: Edit  
- Zone → Cache Rules: Edit (cdn)
- Account → Account Settings: Read (account id)

---

## Implementation phases

| Phase | Todos | Deliverable |
|-------|-------|-------------|
| **STORAGE-PRO** | `pro-storage-*` | S3-grade storage |
| **EDGE-PRO-0** | `pro-edge-0` | CF secrets + wizard connect |
| **EDGE-PRO-1** | `pro-edge-1` | tunnel_manager live + cloudflared |
| **EDGE-PRO-2** | `pro-edge-2` | domain_manager live + zone discovery |
| **EDGE-PRO-3** | `pro-edge-3` | Public hostname wizard + bespoke Edge UI |
| **EDGE-PRO-4** | `pro-edge-4` | cdn_manager CF cache + purge |
| **EDGE-PRO-5** | `pro-edge-5` | balancer_manager health checks |
| **EDGE-PRO-6** | `pro-edge-6` | registry_manager pull secrets + docs |
| **EDGE-PRO-7** | `pro-edge-7` | CF Access + WAF + rate limits (north-south security) |

### Full edge todo checklist

**pro-edge-1** (tunnel): pro-edge-1a–1n in [tunnel_manager.md](./tunnel_manager.md)  
**pro-edge-2** (DNS): pro-edge-2a–2n in [domain_manager.md](./domain_manager.md)  
**pro-edge-3** (wizard): Public hostname wizard + EdgeManager + `aerekos edge` + runbook migration  
**pro-edge-4** (CDN): pro-edge-4a–4g in [cdn_manager.md](./cdn_manager.md)  
**pro-edge-5** (balancer): pro-edge-5a–5g in [balancer_manager.md](./balancer_manager.md)  
**pro-edge-6** (registry): pro-edge-6a–6f in [registry_manager.md](./registry_manager.md)  
**pro-edge-7** (security): pro-edge-7a–7g above

---

## Bespoke console (not ManagerConsole)

| Screen | Priority |
|--------|----------|
| **EdgeManager** | tunnel + DNS + hostname wizard (P2) |
| **StorageManager** | enhance existing — lifecycle, versioning, app access (P1) |
| **CDN** tab in EdgeManager or sub-panel (P3) |

---

## Links

- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [scripts/deploy/provision-cf-service-token.sh](../../scripts/deploy/provision-cf-service-token.sh) — SSH Access tokens (separate from tunnel API token)
- Per-service plans updated below

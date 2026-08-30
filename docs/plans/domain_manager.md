# domain_manager — production plan (pro)

**Port:** 3111 · **AWS analog:** Route 53 · **Category:** Edge · **Tier:** real API → **pro** (needs CF secrets)

**Navigation:** [← tunnel_manager](./tunnel_manager.md) · [edge_stack_pro](./edge_stack_pro.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [registry_manager →](./registry_manager.md)  
**Todos:** `pro-edge-2` (pro-edge-2a–2n below)

---

## Summary

Cloudflare DNS CRUD per zone + project. API exists; needs **zone discovery**, **tunnel pairing**, and **Public hostname wizard**.

## Pro production checklist

### Bootstrap
- [ ] Same CF secrets as tunnel_manager (EDGE-PRO-0)

### DNS pro (EDGE-PRO-2)
- [ ] **pro-edge-2a** `GET /api/v1/dns/zones` — list zones from Cloudflare account
- [ ] **pro-edge-2b** Auto-suggest records for tunnel CNAME (`<id>.cfargotunnel.com`)
- [ ] **pro-edge-2c** Record validation (proxied vs DNS-only, TTL)
- [ ] **pro-edge-2d** SSL/TLS mode metadata on zone (flexible/full/strict) — read from CF
- [ ] **pro-edge-2e** Wildcard + apex record guards (prevent accidental `*` delete)
- [ ] **pro-edge-2f** `requireAuth` on all routes
- [ ] **pro-edge-2g** Idempotency on record create (same name/type)

### Wizard integration (EDGE-PRO-3)
- [ ] **pro-edge-2h** Public hostname wizard step 4: create `CNAME` after tunnel
- [ ] **pro-edge-2i** Health check: DNS resolves + HTTPS probe via conductor
- [ ] **pro-edge-2j** Console: DNS table with tunnel link column

### Console & CLI
- [ ] **pro-edge-2k** EdgeManager DNS tab
- [ ] **pro-edge-2l** `aerekos dns zones|records create|list|delete`

### Testing
- [ ] **pro-edge-2m** Mock CF DNS API integration tests
- [ ] **pro-edge-2n** Document prod zones (`aerekos.com`) in runbook

---

## App access

**Admin-only.**

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md)

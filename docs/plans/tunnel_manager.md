# tunnel_manager — production plan (pro)

**Port:** 3110 · **AWS analog:** Cloudflare Tunnel · **Category:** Edge · **Tier:** real API → **pro** (needs CF secrets)

**Navigation:** [← git_manager](./git_manager.md) · [edge_stack_pro](./edge_stack_pro.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [domain_manager →](./domain_manager.md)  
**Todos:** `pro-edge-0` · `pro-edge-1` (pro-edge-1a–1n below)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

Cloudflare Tunnel API (`cfd_tunnel`) — create/list/delete tunnels; **token returned once**. Code is real; prod needs **secrets_manager bootstrap** + **cloudflared** orchestration + **Edge UI**.

## Current state

| Area | Status |
|------|--------|
| API client | `CloudflareTunnelClient` — live CF API |
| Tests | `tunnelsApi.test.js` + `SKIP_CLOUDFLARE=1` |
| Console | ManagerConsole only |
| cloudflared | **Not orchestrated** — manual on prod today |
| Credentials | Env `CLOUDFLARE_API_TOKEN` — should be secrets_manager |

---

## Pro production checklist

### Bootstrap (EDGE-PRO-0)
- [ ] **pro-edge-0a** Load `cloudflare.api_token` + `account_id` from secrets_manager
- [ ] **pro-edge-0b** Readiness probe: `GET /api/v1/tunnels` with live CF or clear misconfig message
- [ ] **pro-edge-0c** Setup wizard: “Connect Cloudflare” before create tunnel

### Tunnel lifecycle (EDGE-PRO-1)
- [ ] **pro-edge-1a** Ingress config API — map hostname → origin URL (conductor, ai_manager, etc.)
- [ ] **pro-edge-1b** Store ingress JSON on tunnel row; push to cloudflared config
- [ ] **pro-edge-1c** **cloudflared** sidecar or systemd template on prod worker — deploy from conductor
- [ ] **pro-edge-1d** UI: show tunnel token **once** on create (copy + warning)
- [ ] **pro-edge-1e** Reconcile job: poll CF status → update `cf_status` column
- [ ] **pro-edge-1f** Import existing prod tunnels into DB (migration script)
- [ ] **pro-edge-1g** `requireAuth` on all routes

### Integration
- [ ] **pro-edge-1h** Pair with domain_manager — CNAME target = `{tunnel-id}.cfargotunnel.com`
- [ ] **pro-edge-1i** Headscale: origins can use overlay IP (private) vs public tunnel (dual path doc)
- [ ] **pro-edge-1j** Audit log: tunnel create/delete

### Console & CLI
- [ ] **pro-edge-1k** **EdgeManager** screen (or tunnel tab) — not generic ManagerConsole
- [ ] **pro-edge-1l** `aerekos tunnel create|list|delete` + `aerekos edge hostname create`

### Testing
- [ ] **pro-edge-1m** Integration test with mocked CF API (nock)
- [ ] **pro-edge-1n** e2e: SKIP_CLOUDFLARE off in staging with real token

---

## App access

**Admin-only** — platform operators; no app credentials.

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md)
- [domain_manager.md](./domain_manager.md)

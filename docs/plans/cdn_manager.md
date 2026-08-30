# cdn_manager — production plan (pro)

**Port:** 3118 · **AWS analog:** CloudFront · **Category:** Edge · **Tier:** stub → **pro**

**Navigation:** [edge_stack_pro](./edge_stack_pro.md) · [balancer_manager](./balancer_manager.md)

---

## Summary

Today: SQLite cache-rule metadata only. **Pro:** Cloudflare cache rules + purge API tied to zones from domain_manager.

## Pro production checklist (EDGE-PRO-4)

- [ ] **pro-edge-4a** CF Cache Rules API — create/list/update/delete (or Page Rules fallback)
- [ ] **pro-edge-4b** Cache purge by URL, tag, or prefix (`POST /api/v1/cdn/purge`)
- [ ] **pro-edge-4c** Link rule `origin` → storage_manager signed URL or conductor static
- [ ] **pro-edge-4d** Setup wizard optional step after hostname (enable caching)
- [ ] **pro-edge-4e** `requireAuth`; project + zone scoping
- [ ] **pro-edge-4f** EdgeManager CDN tab; `aerekos cdn rules|purge`
- [ ] **pro-edge-4g** Integration tests with mocked CF

---

## Dependencies

`secrets_manager` (CF token) + `domain_manager` (zone_id)

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md)

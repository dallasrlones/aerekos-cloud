# balancer_manager — production plan (pro)

**Port:** 3109 · **AWS analog:** ELB · **Category:** Edge · **Tier:** stub → **pro**

**Navigation:** [edge_stack_pro](./edge_stack_pro.md) · [cdn_manager](./cdn_manager.md)

---

## Summary

Today: target address hints only. **Pro:** health-checked target groups wired to `compute_manager` tasks + optional CF load balancing metadata.

## Pro production checklist (EDGE-PRO-5)

- [ ] **pro-edge-5a** Target group model: `{ name, targets[], health_check_path, interval }`
- [ ] **pro-edge-5b** Active health probe (HTTP GET) — update target `healthy` flag
- [ ] **pro-edge-5c** Register/deregister compute_manager task endpoints as targets
- [ ] **pro-edge-5d** Integrate with tunnel ingress (route traffic to healthy target only)
- [ ] **pro-edge-5e** Metrics: healthy_host_count, unhealthy_host_count
- [ ] **pro-edge-5f** Console: target group UI in EdgeManager or ComputeManager link
- [ ] **pro-edge-5g** `aerekos balancer targets|health`

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md)
- [compute_manager.md](./compute_manager.md)

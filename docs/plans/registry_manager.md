# registry_manager — production plan (pro)

**Port:** 3129 · **AWS analog:** ECR · **Category:** Dev tools · **Tier:** real-partial → **pro** (metadata now; runtime later)

**Navigation:** [domain_manager](./domain_manager.md) · [edge_stack_pro](./edge_stack_pro.md)

---

## Summary

Registry entry metadata + public config. **Pro phase 1:** pull secrets + CI push docs; **phase 2:** optional local registry v2.

## Pro production checklist (EDGE-PRO-6)

- [ ] **pro-edge-6a** `credential_ref` → secrets_manager secret name (validated on create)
- [ ] **pro-edge-6b** Setup wizard: link registry URL + robot token for deploy pipelines
- [ ] **pro-edge-6c** ARN: `arn:aerekos:{pid}:registry:repository/{name}` (app pull scope future)
- [ ] **pro-edge-6d** `GET /api/v1/registry/config` includes auth method, never plaintext secret
- [ ] **pro-edge-6e** Document Docker login via conductor proxy vs external registry
- [ ] **pro-edge-6f** (Later) Deploy docker/registry:2 via compute_manager for on-prem ECR

---

## Links

- [edge_stack_pro.md](./edge_stack_pro.md)
- [cicd_manager.md](./cicd_manager.md)

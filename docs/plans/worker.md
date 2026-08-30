# worker (node runtime) — production plan

**Not a manager service** — the Docker host agent that registers with conductor and runs manager containers.

**Navigation:** [Index](./README.md) · [MASTER_TODOS.md](./MASTER_TODOS.md) · [host_manager](./host_manager.md), [worker_manager](./worker_manager.md), [release_fleet.md](./release_fleet.md), [conductor](./conductor.md)

---

## Summary

Self-registers with conductor via `WORKER_TOKEN`, reports CPU/RAM/disk, heartbeats, deploys manager containers per conductor instructions. **Orin** runs GPU AI stack; **oculus/dev** join as workers.

## Current state

| Area | Status |
|------|--------|
| Registration + heartbeat | Complete |
| Docker deployment | Complete |
| Tests | 124 tests passing per worker/plan.md |
| Split topology | prod-mini (full) + orin/oculus (worker) |

### Known gaps (production)

- Orin `SECRETS_MANAGER_URL` / `CONDUCTOR_URL` must use **LAN HTTP** — Cloudflare TLS breaks Jetson
- `docker-compose.ai.yml` separate from main worker compose — document when to use which
- Resource detection via `detect-host-resources.sh` — verify on Orin after deploy
- Updater sidecar version drift — see DEPLOYMENT.md
- No unified `AUTH_REQUIRED` rollout on worker-hosted managers

---

## Production tasks

### cc-worker-fleet

- [ ] **cc-worker-fleet** Document prod vs orin env matrix in [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [ ] **lock-9** `worker/.env_example`: LAN vs public URL rules (never cloudapi TLS for secrets on Orin)
- [ ] Post-deploy smoke: heartbeat, ai_manager `/health`, auth_manager token mint
- [ ] **lock-2** `generate-full-stack.mjs`: `AUTH_REQUIRED=true` for managers on worker role
- [ ] **cc-fleet-1** Wire host_manager sync from worker registry
- [ ] **cc-fleet-4** Tailscale sidecar on register — [vpc_network.md](./vpc_network.md) cc-hs-3/4
- [ ] Migrate Orin URLs LAN → `*.aerekos.internal` after cc-hs-5
- [ ] **release-fleet-2** Verify updater sidecar on Orin
- [ ] Log shipper → `logs_manager` under load
- [ ] Graceful conductor unreachable — verify Orin power cycle

---

## Links

- [worker/plan.md](../../worker/plan.md)
- [worker/MANAGER_SERVICES.md](../../worker/MANAGER_SERVICES.md)
- [DEPLOYMENT.md](../../DEPLOYMENT.md)

# Runbook — Deploy

**Source of truth is the Mac checkout.** Devices are deploy targets. After any aerekos-cloud change: edit on Mac, then push and rebuild **all three** boxes. Do not ship conductor without workers, or workers without conductor.

## From the Mac (canonical)

```bash
# Review what would change (no writes)
bash scripts/deploy/sync-diff.sh prod-mini
bash scripts/deploy/sync-diff.sh dev-mini
bash scripts/deploy/sync-diff.sh oculus

# Pull device-only files onto Mac first if a box has a unique fix
# (does not overwrite files that already exist on Mac)
bash scripts/deploy/pull-from-host.sh prod-mini

# Push Mac → all devices (no --delete; secrets/env preserved)
SYNC_CONFIRM=yes bash scripts/deploy/push-to-all.sh
```

Then rebuild roles **on each device**:

| SSH | Role | Command on the box |
|-----|------|-------------------|
| `prod-mini` | conductor (bind-mounted) + managers | Bind-mount API changes: `docker restart aerekos-cloud-conductor`. Compose `extra_hosts` / network: `docker compose -f docker-compose.yml up -d --no-deps --force-recreate conductor`. Managers: `docker compose -f docker-compose.core.yml up -d --no-deps --build storage_manager` (and other managers you actually run). Avoid `deploy.sh full` on a mixed stack unless you intend to start `docker-compose.full.yml`. Details: [mixed-stack.md](mixed-stack.md). |
| `dev-mini` | worker | `cd ~/work/aerekos/aerekos-cloud && bash scripts/deploy/deploy.sh worker` |
| `oculus` | worker + GPU ai | New device: `docker run` the worker (socket + NVIDIA runtime + Cloud token), then Place engines in AI Manager. Existing Orin may still use `deploy.sh worker` / `ai`. **Do not restart a healthy vLLM.** Do not start voice from `~/work/tools`. LoRA: [lora-gpu.md](lora-gpu.md). Voice: [ai_manager_tts.md](../services/ai_manager_tts.md). |

`scripts/deploy/push-to-prod.sh` / `push-to-host.sh` never overwrite `.env`, `worker/.env`, `.worker-host.env`, `data/`, or `node_modules/`.

**Do not rebuild `auth_manager` from Mac** unless that tree still serves `POST /api/v1/auth/token`. Icarus C0 mint depends on the **live** image. After a rebuild, smoke `POST /api/v1/auth/token` and roll back that one image if mint fails.

`deploy.sh full` must never pass `--remove-orphans`. Start missing managers with `compose up -d --no-deps`. vLLM only on orin (`deploy.sh ai-vllm`); if it exits 137, leave it stopped.

## Mixed compose (current homelab)

prod-mini runs **conductor/frontend/worker** from `docker-compose.yml` (`aerekos-cloud-conductor` on `aerekos-cloud_aerekos-cloud-network`) and **managers** from `docker-compose.core.yml` (`aerekos-cloud_aerekos`). Conductor also joins that managers network (`core_managers` / `AEREKOS_CORE_NETWORK`) with alias `aerekos-conductor` so managers whose `CONDUCTOR_URL` still points at the core-compose hostname reach this process on port 3000. Managers must use `CONDUCTOR_INTERNAL_URL` (default `http://host.docker.internal:3300`) so they can reach the published conductor port. Conductor needs `extra_hosts: host.docker.internal:host-gateway` so `_directServiceRequest` can reach published manager ports (`secrets_manager:3107`, `storage_manager:3003`, …). Recreate conductor after changing compose (`docker compose -f docker-compose.yml up -d --no-deps --force-recreate conductor`) — a plain restart is not enough. See comments in `docker-compose.core.yml` and the full write-up in [mixed-stack.md](mixed-stack.md).

Icarus live smokes: [icarus-c0.md](icarus-c0.md), [icarus-live-e2e.md](icarus-live-e2e.md). Runbook index: [README.md](README.md).

## Standard deploy (CI)

```bash
gh workflow run deploy.yml -f target=all
gh run watch
```

CI checks out git. Until the Mac working tree is committed and pushed, **Mac rsync is the live path**.

## Post-deploy checks

1. `curl -fsS https://cloudapi.aerekos.com/health`
2. `node e2e/icarus-c0-smoke.js` with Icarus `.env` loaded (`AEREKOS_API_URL` is the public conductor). Details: [icarus-c0.md](icarus-c0.md). C1–C8 + T65: [icarus-live-e2e.md](icarus-live-e2e.md).
3. Dashboard → Devices — workers online
4. If you shipped LoRA: `ssh orin.aerekos.com docker logs aerekos-lora_trainer` — [lora-gpu.md](lora-gpu.md)

SSH from any network: `prod.aerekos.com`, `dev.aerekos.com`, `orin.aerekos.com`. Do not health-check private IPs.

## Rollback

Restore the previous Mac tree (git or backup), push-to-all, rebuild the same roles.

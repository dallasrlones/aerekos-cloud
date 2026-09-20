# Runbook — Fleet startup after power loss

Bring boxes back **conductor first**, then workers, then GPU. Reach them from any network over Cloudflare Access SSH.

## Topology

| SSH | Role |
|-----|------|
| `prod.aerekos.com` | Conductor + UI + local worker + cloudflared |
| `dev.aerekos.com` | Remote worker |
| `orin.aerekos.com` | GPU worker + ai_manager + lora_trainer (vLLM separate compose) |

On-LAN aliases (`prod-mini`, `dev-mini`, `oculus`) are the same boxes. **Do not** put private IPs in Icarus or worker examples. Icarus `.env` `AEREKOS_API_URL` is the public conductor.

Public URLs:

- UI: https://cloud.aerekos.com
- API: https://cloudapi.aerekos.com

---

## 1. Conductor — start first

```bash
ssh prod.aerekos.com
cd ~/work/aerekos/aerekos-cloud

# Ensure Docker is running (Mac: open Docker Desktop)

# Start existing containers (fast path — no rebuild):
docker start aerekos-cloud-conductor aerekos-cloud-frontend aerekos-cloud-worker \
  aerekos-auth_manager aerekos-key_manager aerekos-secrets_manager \
  aerekos-storage_manager aerekos-updater cloudflared-tunnel

# Verify (on the box after SSH — loopback is the published conductor port)
curl -fsS http://127.0.0.1:3300/health
curl -fsS -o /dev/null -w '%{http_code}\n' http://127.0.0.1:19006/
docker ps --filter name=cloudflared
```

If containers are missing or broken, rebuild is blocked by husky in `npm prepare` — use **start existing** or rsync fresh code from Mac:

```bash
# From your MacBook:
DEPLOY_AFTER=1 bash scripts/deploy/push-to-prod.sh
```

### Registration token mismatch

Workers use the **DB registration token**, not necessarily `WORKER_TOKEN` in `.env`.

Get the live token:

```bash
ssh prod.aerekos.com 'docker exec aerekos-cloud-conductor node -e "
const {Token}=require(\"./api/models\");
Token.findAll({where:{active:1}}).then(r=>console.log(r[0]?.token));
"'
```

Update prod `.env` and recreate local worker:

```bash
# On the conductor host — set TOKEN to output above
sed -i 's/^WORKER_TOKEN=.*/WORKER_TOKEN=<TOKEN>/' ~/work/aerekos/aerekos-cloud/.env
cd ~/work/aerekos/aerekos-cloud
export $(grep -v '^#' .env | xargs)
docker compose -f docker-compose.yml up -d --force-recreate worker
```

---

## 2. Dev worker

```bash
ssh dev.aerekos.com
cd ~/work/aerekos/aerekos-cloud/worker

# If disk full:
docker system prune -af --volumes   # frees space; removes unused images

# Sync token from prod (see above), then:
sed -i 's/^CONDUCTOR_TOKEN=.*/CONDUCTOR_TOKEN=<TOKEN>/' .env

# Must recreate (restart does NOT reload .env):
docker compose up -d --force-recreate worker

docker logs aerekos-worker --tail 20
# Expect: "Worker registered successfully via WebSocket!"
```

`worker/.env` should have:

```
CONDUCTOR_URL=https://cloudapi.aerekos.com
CONDUCTOR_TOKEN=<token from conductor DB>
```

---

## 3. GPU worker + AI

```bash
ssh orin.aerekos.com
cd ~/work/aerekos/aerekos-cloud/worker

sed -i 's/^CONDUCTOR_TOKEN=.*/CONDUCTOR_TOKEN=<TOKEN>/' .env
docker compose up -d --force-recreate worker

# New GPU device: docker run the worker (socket + NVIDIA runtime + CONDUCTOR_URL/TOKEN).
# Place engines from Cloud AI Manager — do not apt-install Ollama or clone this repo.
# Existing Orin bootstrap (optional):
# cd ~/work/aerekos/aerekos-cloud && bash scripts/deploy/deploy.sh ai
# Do not start ~/work/tools voice. Do not start aerekos-vllm if it is stopped.
```

---

## 4. Verify

```bash
# From laptop
curl -fsS https://cloudapi.aerekos.com/health
curl -fsS -o /dev/null -w '%{http_code}\n' https://cloud.aerekos.com/

# Registered workers
ssh prod.aerekos.com 'docker exec aerekos-cloud-conductor node -e "
const {Worker}=require(\"./api/models\");
Worker.findAll().then(w=>w.forEach(x=>console.log(x.hostname, x.ip_address, x.status)));
"'
```

Console → **Devices** should show the three workers **online**.

---

## Common failures (2026-08-24 incident)

| Symptom | Cause | Fix |
|---------|-------|-----|
| `cloud.aerekos.com` 502/522 | Conductor/frontend stopped; tunnel still up | Start `aerekos-cloud-conductor` + `aerekos-cloud-frontend` on the conductor host |
| Workers `websocket error` | Conductor down | Start conductor host first |
| `Invalid registration token` | `.env` token ≠ conductor DB token | Query DB token; update `.env`; **force-recreate** container |
| worker `no space left on device` | Disk 100% full | `docker system prune -af --volumes` |
| `docker restart` doesn't fix token | Env baked at create time | `docker compose up -d --force-recreate worker` |

## cloudflared

Tunnel container on the conductor host: `cloudflared-tunnel` (or `aerekos_tunnel`). Should be **Up** independently of the app stack. If public URLs fail, check:

```bash
ssh prod.aerekos.com 'docker logs cloudflared-tunnel --tail 30'
```

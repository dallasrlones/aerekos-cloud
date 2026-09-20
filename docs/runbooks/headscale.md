# Headscale (fleet mesh)

East-west overlay for workers. Cloudflare stays north-south (`cloud` / `cloudapi`).

## Setup

1. Run Headscale on the **control** device (prod-mini). Bind the API to the **LAN** (`192.168.0.141:8080`) so other devices can join. Do not publish it on the public internet.
   `docker compose -f docker-compose.headscale.yml up -d --no-deps`
   Worker sidecar: `docker compose -f worker/docker-compose.tailscale.yml up -d --no-deps` (needs `TAILSCALE_AUTHKEY` from preauth).
2. Store `headscale.api_key` in secrets_manager. Set `HEADSCALE_URL` and `HEADSCALE_BASE_DOMAIN=aerekos.internal` on the conductor.
3. Console: Network / VPC → enable mesh → join this device → probe `conductor.aerekos.internal`.
4. APIs:
   - `GET /api/services/network_manager/api/v1/mesh`
   - `POST /api/services/network_manager/api/v1/mesh/preauth` — tagged key, shown once
   - `POST /api/services/network_manager/api/v1/mesh/preauth/:id/revoke` — **never** revoke `tag:worker` / `tag:platform`

## Project networks

On project create, Cloud ensures a Docker bridge named `default` on assigned workers (`POST /networks/ensure-default`). Compute tasks attach to it unless `network: host`.

Do not expose Headscale :8080 on the internet. Do not put registry :5050 on the public net.

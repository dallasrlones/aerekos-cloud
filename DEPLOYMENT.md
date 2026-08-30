# Deployment & CI/CD

How code gets from GitHub onto the fleet, and how to operate it.

## Topology

| Device      | Runner label        | Role     | Stack |
|-------------|---------------------|----------|-------|
| `prod-mini` | `self-hosted,aerekos,prod`   | `full`   | conductor + frontend + local worker + all managers (`docker-compose.full.yml`) |
| `oculus`    | `self-hosted,aerekos,oculus` | `worker` | a single worker that joins the conductor (`worker/docker-compose.yml`) |
| `dev-mini`  | `self-hosted,aerekos,dev`    | `worker` | a single worker that joins the conductor |

## How it works

Each device runs a **self-hosted GitHub Actions runner**. Runners pull jobs
*outbound* from GitHub, so there is **no inbound SSH and no Cloudflare Access in
the deploy path** — deploys keep working even when the Cloudflare edge is having
a bad day.

A deploy is **manual**: you trigger it from the Actions tab. The job lands on the
target device's runner and runs [`scripts/deploy/deploy.sh`](scripts/deploy/deploy.sh),
which:

1. **Syncs the code.** `actions/checkout` has already put the exact commit in the
   runner's workspace (authenticated with GitHub's ephemeral token), so the
   script **rsyncs that checkout into the canonical deploy dir**
   (`~/work/aerekos/aerekos-cloud`). The devices therefore need **no git remote
   or GitHub credentials of their own**. Running from the canonical dir keeps the
   docker compose project name — and your named volumes / data — stable.
   (Run by hand from a real git clone, it `git reset --hard` instead.)
2. **Stamps the version.** Exports `APP_VERSION` = the deployed git short SHA and
   writes a `VERSION` marker. The conductor and worker containers read this and
   report it (see [Versioning](#versioning--outdated-detection)).
3. Refreshes `.worker-host.env` (real host CPU/RAM/disk/network).
4. `docker compose ... up -d --build` for the device's role.
5. Waits for the core containers to report healthy.

Device-local files — `.env`, `worker/.env`, `.worker-host.env`, `data/`,
`node_modules/`, `.expo/` — are **excluded from the sync** and never overwritten
by a deploy.

## Triggering a deploy

GitHub → **Actions** → **Deploy** → **Run workflow** → pick a target:

- `all` — deploy every device
- `prod` / `oculus` / `dev` — just that one

Or from the CLI:

```bash
gh workflow run deploy.yml -f target=all
gh run watch
```

## One-time per-device setup

Do this once on each device (prod-mini, oculus, dev-mini).

### 1. Create the canonical deploy dir

The device does **not** need a git clone — the runner rsyncs the code in. You
just need the directory to exist so you can drop the `.env` in it:

```bash
mkdir -p ~/work/aerekos/aerekos-cloud
```

> The deploy script defaults to `~/work/aerekos/aerekos-cloud`. Override with
> `AEREKOS_DEPLOY_DIR` if it lives elsewhere. (A real `git clone` here also works
> and enables the by-hand `git`-pull mode.)

### 2. Create the device-local env

**Conductor host (`prod`):** copy `.env_example` → `.env` and set the real
secrets:

```bash
cd ~/work/aerekos/aerekos-cloud
cp .env_example .env
# Set: CONDUCTOR_PORT, FRONTEND_PORT, WORKER_PORT, WORKER_TOKEN,
#      JWT_SECRET, TOKEN_SECRET, EXPO_PUBLIC_API_URL (e.g. https://cloudapi.aerekos.com),
#      KEY_MANAGER_MASTER_KEY, ...
```

**Worker hosts (`oculus`, `dev`):** set `worker/.env`:

```bash
cd ~/work/aerekos/aerekos-cloud/worker
cp .env_example .env
# Set: CONDUCTOR_URL=https://cloudapi.aerekos.com
#      CONDUCTOR_TOKEN (the conductor's worker registration token)
```

### 3. Install the runner

Get a registration token (valid ~1h):

```bash
gh api -X POST repos/dallasrlones/aerekos-cloud/actions/runners/registration-token -q .token
```

Then on the device:

```bash
cd ~/work/aerekos/aerekos-cloud
GH_RUNNER_TOKEN=<token> bash scripts/deploy/setup-runner.sh --labels prod     # prod-mini
GH_RUNNER_TOKEN=<token> bash scripts/deploy/setup-runner.sh --labels oculus   # oculus
GH_RUNNER_TOKEN=<token> bash scripts/deploy/setup-runner.sh --labels dev      # dev-mini
```

This downloads the official runner, registers it as
`self-hosted,aerekos,<label>`, and installs it as a service (systemd on Linux,
launchd on macOS) so it survives reboots.

Verify under GitHub → Settings → Actions → Runners (should show "Idle").

## Deploying by hand (no CI)

The same script works locally on a device. If the dir is a git clone it pulls
first; otherwise it just rebuilds the code already on disk:

```bash
cd ~/work/aerekos/aerekos-cloud
bash scripts/deploy/deploy.sh full      # on the conductor host
bash scripts/deploy/deploy.sh worker    # on a worker host
```

You can also push from your laptop with `rsync` + `docker compose` over SSH
(see the service-token SSH setup below) — that is exactly what `deploy.sh` does
on the device.

---

## Versioning & outdated detection

Every device reports the **git short SHA it was deployed at** so the conductor
can tell you when a device is running stale code.

- `deploy.sh` exports `APP_VERSION=<short-sha>` into the conductor and worker
  containers (`docker-compose.full.yml` / `worker/docker-compose.yml`).
- The worker includes that version in every heartbeat; the conductor stores it.
- `GET /api/version` returns the **conductor's** version (the "current" baseline).
- `GET /api/workers` (and `/api/workers/:id`) tag each device with
  `version`, `current_version`, and `outdated` (`true` only when the device's
  version is known *and* differs from the conductor's).
- The dashboard shows the version on **Devices** and **Device details**, with an
  amber **`outdated`** badge when a device falls behind.

So after a `target=all` deploy every device matches the conductor and shows as
up to date. Deploy `prod` alone and the workers immediately flag as `outdated`
until you redeploy them.

> Devices running pre-versioning code report no version; they show as *not*
> outdated (unknown) until they're redeployed once with this feature.

---

## SSH without re-authing Cloudflare Access every time

> **Already provisioned** for `prod`/`dev`/`orin` — the service token is attached
> to each SSH Access app and wired into `~/.ssh/config`, so `ssh prod.aerekos.com`
> is non-interactive. The notes below are for re-running it (e.g. token rotation
> or a new host).

`ssh prod.aerekos.com` goes through **Cloudflare Access**, whose browser session
expires every day or two — that's the re-auth nag (it is *not* your SSH key).
Fix it permanently with an Access **service token**:

```bash
source ~/work/cloudflare/env.sh        # exports CLOUDFLARE_API_TOKEN
bash scripts/deploy/provision-cf-service-token.sh --hosts prod.aerekos.com,dev.aerekos.com,orin.aerekos.com
```

This creates a service token, attaches a `non_identity` policy to each SSH Access
app (at the next free precedence, so it sits alongside your existing identity
policy), and prints a `~/.ssh/config` snippet. Paste the snippet's `ProxyCommand`
(with `--service-token-id` / `--service-token-secret`) under each host and you'll
never see the browser login again.

> The token's client **secret is shown only once** at creation — capture it.
> Re-running the script makes a *new* token.

> Run it from a network that can actually reach `api.cloudflare.com`. Some
> networks transparently block TLS to Cloudflare hosts (TCP connects but the
> handshake is reset) — if the script times out, switch networks and retry.

## Troubleshooting

- **Job stuck "Waiting for a runner"** — the device's runner is offline. Check
  `sudo ~/actions-runner-aerekos/svc.sh status` (Linux) or
  `~/actions-runner-aerekos/svc.sh status` (macOS).
- **`Missing .env`** — the device-local env wasn't created (step 2 above).
- **A service won't go healthy** — the deploy prints the last 30 log lines for
  that container and fails the job. Inspect with
  `docker compose -f docker-compose.full.yml logs <service>`.
- **Volumes/data look reset** — make sure you deploy from the canonical clone
  (`~/work/aerekos/aerekos-cloud`); a different directory changes the docker
  compose project name and detaches the named volumes.

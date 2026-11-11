# Deployment & CI/CD

How code gets onto the fleet, and how to operate it.

## Auto path (canonical) — ADR 003

**Source of truth:** [`git.aerekos.com`](https://git.aerekos.com) (git_manager), system project repo `aerekos-cloud`.  
**Not** public GitHub. Laptop `origin` should point at git.aerekos.com (optional `github` remote is a mirror only).

```text
push/merge → git.aerekos.com (post-receive → recordPush)
          → cicd_manager pipeline aerekos-cloud-fleet (git_ref=main, action=fleet)
          → POST /api/releases (tarball) + POST /api/fleet/updates/run-now
          → aerekos-updater on each device (ROLE=core|worker) extracts + rebuilds
```

See [`docs/adr/003-git-as-origin.md`](docs/adr/003-git-as-origin.md).

| Device | Updater `ROLE` | Stack applied |
|--------|----------------|---------------|
| `prod-mini` | `core` | `docker-compose.core.yml` (+ platform); never `full.yml` on mixed prod |
| `dev-mini` | `worker` | `worker/docker-compose.yml` |
| `oculus` (orin) | `worker` | `worker/docker-compose.yml` |

**Do not** `git pull` on devices for routine deploys. Updaters apply the release artifact.

### Operator workflow

1. Develop on laptop (or prod) with `origin` → git.aerekos.com.
2. `git push origin main` (normal push so hooks fire — avoid bare `update-ref` FF without `recordPush`).
3. Confirm `GET /api/releases/latest` shows a **large** tarball (megabytes, not ~100 bytes) and matching short SHA.
4. Confirm each host `~/work/aerekos/aerekos-cloud/VERSION` advances.

Bootstrap (once): [`scripts/deploy/bootstrap-git-fleet.js`](scripts/deploy/bootstrap-git-fleet.js).

### Known fix (2026-11-11)

`cicd_manager` must have **git** installed in its image, and `bundleToReleaseTar` must clone into a **fresh** directory. Without that, fleet publishes empty ~100B tarballs and VERSION can advance without code.

---

## Legacy / manual — GitHub Actions (not auto)

> **Legacy.** Do **not** use this as the automatic fleet path. Kept for emergency/manual use only.

Each device *may* still have a self-hosted GitHub Actions runner. Manual deploy:

GitHub → **Actions** → **Deploy** → **Run workflow** → pick target (`all` / `prod` / `oculus` / `dev`).

Or:

```bash
gh workflow run deploy.yml -f target=all
gh run watch
```

That runs [`scripts/deploy/deploy.sh`](scripts/deploy/deploy.sh) on the labeled runner (`self-hosted,aerekos,<host>`). Prefer the ADR 003 updater path above.

### Topology (legacy runner labels)

| Device | Runner label | Historical role note |
|--------|--------------|----------------------|
| `prod-mini` | `self-hosted,aerekos,prod` | full/core stack |
| `oculus` | `self-hosted,aerekos,oculus` | worker |
| `dev-mini` | `self-hosted,aerekos,dev` | worker |

### Deploying by hand (no CI)

```bash
cd ~/work/aerekos/aerekos-cloud
bash scripts/deploy/deploy.sh full      # conductor host (prefer core compose on mixed prod)
bash scripts/deploy/deploy.sh worker    # worker host
```

Device-local files — `.env`, `worker/.env`, `.worker-host.env`, `data/`, `node_modules/`, `.expo/` — must not be overwritten by sync.

---

## Versioning & outdated detection

Every device reports the **git short SHA / release version** it was deployed at so the conductor can tell you when a device is running stale code.

- Updaters / `deploy.sh` write `VERSION` and export `APP_VERSION`.
- Workers include version in heartbeats; conductor stores it.
- `GET /api/version` returns the conductor baseline.
- `GET /api/workers` tags `version`, `current_version`, `outdated`.

---

## SSH without re-authing Cloudflare Access every time

See historical notes in git history / runbooks for cloudflared Access service tokens. Fleet deploy itself does **not** require inbound SSH.

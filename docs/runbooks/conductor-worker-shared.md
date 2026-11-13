# Conductor + `worker/shared` mount

Conductor code loads shared monorepo modules through `conductor/api/utils/loadWorkerShared.js`. At runtime it tries, in order:

1. Monorepo path: `worker/shared/<module>`
2. Container path: `/app/worker-shared/<module>`

The **conductor image does not bundle** the full worker tree. Without a bind mount (or an image build that copies shared code), calls that `requireShared(...)` fail with `worker shared module not found`.

## Required volume

When running conductor from the monorepo (dev or homelab), mount the shared library read-only:

```yaml
services:
  conductor:
    volumes:
      - ./worker/shared:/app/worker-shared:ro
```

This matches the root `docker-compose.yml` conductor service and the **`docker-compose.conductor-shared.yml` overlay pattern**: a small compose fragment you merge with `conductor/docker-compose.yml` so click-ops catalog, ARN helpers, metrics re-exports, and other shared seams resolve inside the container.

### Example overlay (repo root)

Save as `docker-compose.conductor-shared.yml`:

```yaml
services:
  conductor:
    volumes:
      - ./worker/shared:/app/worker-shared:ro
```

Run from repo root:

```bash
docker compose -f conductor/docker-compose.yml \
  -f docker-compose.conductor-shared.yml up -d conductor
```

Paths are relative to the **first** compose file’s directory unless you use an absolute path; when conductor’s compose lives under `conductor/`, prefer either running from root with the fragment above or adjust the mount to `../worker/shared:/app/worker-shared:ro`.

## Production / prod-mini

- **Dev monorepo:** bind mount is normal.
- **Slim conductor-only deploy:** bake `worker/shared` into the image at `/app/worker-shared` in `Dockerfile` (see `conductor/api/utils/loadWorkerShared.js` second candidate path), or ship the overlay compose on the fleet host with the same mount.

## Verify

From a shell with conductor up and mount applied:

```bash
docker compose exec conductor node -e \
  "const {requireShared}=require('./api/utils/loadWorkerShared'); console.log(requireShared('arn.js').buildArn?'ok':'missing');"
```

Expected output: `ok`.

## Related

- [conductor-ha.md](./conductor-ha.md) — SQLite backup/restore (unchanged by this mount).
- `worker/scripts/standardize-dockerfiles.mjs` — manager images copy `worker/shared` to `/app/shared`.

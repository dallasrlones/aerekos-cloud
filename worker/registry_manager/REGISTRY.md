# Container registry in aerekos-cloud

The **worker** runs `docker pull <image>` (via [dockerode](https://github.com/apocas/dockerode)) using the **`docker_image`** string stored on each `Service` in the conductor database. The `registry_manager` service does not pull images; it documents policy and exposes **non-secret** configuration for dashboards and operators.

## How pulls work

1. Conductor stores `docker_image` (e.g. `aerekos-key_manager:latest` or `harbor.example.com/aerekos/key_manager:1.0.0`).
2. The worker’s [`ServiceManager.buildContainerConfig`](../docker/ServiceManager.js) / [`pullImage`](../docker/ServiceManager.js) use that string **as-is**.
3. Any registry authentication must exist where Docker expects it: typically **`docker login`** on the host (or credentials helper), *not* inside `registry_manager`.

## Modes (conceptual)

| Mode | When to use | Image reference example |
|------|----------------|------------------------|
| **local** | Dev: images built on the host (`docker build -t aerekos-key_manager:latest …`) | `aerekos-key_manager:latest` |
| **docker_hub** | Public or private images on Docker Hub / Mirantis | `org/aerekos-key_manager:tag` (private: `docker login` on worker) |
| **harbor** | [Harbor](https://goharbor.io/) (projects, robot accounts, scanning) | `harbor.example.com/project/aerekos-key_manager:1.0.0` |
| **embedded** | Small self-hosted OCI server (e.g. [`registry:2`](https://hub.docker.com/_/registry) on LAN) | `192.168.1.10:5000/aerekos-key_manager:latest` |
| **custom** | ECR, GCR, ACR, Artifactory, Quay, etc. | Full hostname + project/repo path the registry expects |

`REGISTRY_MODE` in `.env` is a **label** for humans and the `GET /api/v1/registry/config` response; the worker does not read it. Everything depends on a valid OCI **image ref** in conductor.

## Harbor vs “embedded” registry

- **Harbor**: full UI, projects, optional LDAP/OIDC, image scanning, replication. Use when you need governance and many teams. Push from CI, set conductor `docker_image` to the Harbor project path, run **`docker login harbor.example.com`** (or a robot account) on each worker before deploy.
- **Embedded `registry:2`**: single binary, minimal, good for a lab or air-gapped lab; often HTTP or self-signed TLS. You still use `docker tag` + `docker push`, then set `docker_image` to `host:port/namespace/image:tag`. Workers need `--insecure-registry` or proper TLS for private use.

## API surface (this service)

- `GET /api/v1/registry/config` — public hints (`mode`, display URL, `auth_expected`). **No passwords.**
- `CRUD /api/v1/registries` — per-project registry entries (`credential_ref` only; no secrets).
- `CRUD /api/v1/artifacts` · `/api/v1/wanted` · project images / import / host inventory — see README OpenAPI.


## Hardening

- Store long-lived pull secrets using **`secrets_manager`** or host-level Docker config, not environment variables in git.
- Rotate Harbor robot tokens on a schedule; use read-only users where possible.

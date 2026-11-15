# Agent prompt — cluster_manager

Docker fleet inventory on the worker host. Optional k3s detect/install only on explicit confirm — never auto-install on prod. EKS is a naming analog only.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cluster_manager{path}`

Port **3151**. Health: `GET /health`, `GET /ready`, `GET /api/v1/info`.

## Endpoints

- `POST /api/v1/ensure-defaults` — Seed default `k3s` cluster if empty
- `POST /api/v1/clusters` — Create a cluster ({ project_id, name, ... })
- `GET /api/v1/clusters` — List clusters (?project_id=)
- `GET /api/v1/clusters/:id` — Get one cluster
- `PATCH /api/v1/clusters/:id` — Update a cluster
- `DELETE /api/v1/clusters/:id` — Delete a cluster
- `GET /api/v1/clusters/:id/fleet` — List docker containers on this host
- `GET /api/v1/clusters/:id/k3s/status` — Detect k3s on the host
- `POST /api/v1/clusters/:id/k3s/install` — Install k3s only if { confirm: true }

OpenAPI: `worker/cluster_manager/api/openapi.yaml`. Tutorial/ServiceGuide: none.

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

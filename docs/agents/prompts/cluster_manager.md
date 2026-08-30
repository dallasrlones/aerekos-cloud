# Agent prompt — cluster_manager

Detect k3s on the worker host. Install only on explicit confirm — never auto-install on prod.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/cluster_manager{path}`

## Endpoints

- `POST /api/v1/clusters` — Create a cluster ({ project_id, name, ... })
- `GET /api/v1/clusters` — List clusters (?project_id=)
- `GET /api/v1/clusters/:id` — Get one cluster
- `PATCH /api/v1/clusters/:id` — Update a cluster
- `DELETE /api/v1/clusters/:id` — Delete a cluster
- `GET /api/v1/clusters/:id/k3s/status` — Detect k3s on the host
- `POST /api/v1/clusters/:id/k3s/install` — Install k3s only if { confirm: true }

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

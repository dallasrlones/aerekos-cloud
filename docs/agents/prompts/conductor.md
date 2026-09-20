# Agent prompt — conductor

Master orchestrator: authentication, the service registry + proxy, worker fleet management, project scoping, and the React Native dashboard. Every client and SDK call enters here.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

## Endpoints

- `GET /health` — Liveness
- `POST /api/auth/login` — Login -> { token } (JWT)
- `GET /api/auth/me` — Current identity
- `GET /api/services` — List all registered manager services
- `GET /api/services/:name` — Get one service
- `POST /api/services/:name/enable` — Enable/deploy a service for a project
- `POST /api/services/:name/disable` — Disable a service
- `POST /api/services/register` — Manager self-registration (service token issued)
- `ANY /api/services/:name/*` — Generic proxy to a manager (JWT/service token)
- `GET /api/workers` — List workers
- `GET /api/workers/:id/host/check` — Host OS/Docker freshness
- `POST /api/workers/:id/host/check` — Re-probe host OS/Docker
- `POST /api/workers/:id/host/update` — Update host OS or Docker ({ target })
- `GET /api/projects/:id/iac/status` — IaC hookup status
- `POST /api/projects/:id/iac/hookup` — Hook up IaC ({ mode, repo })
- `GET /api/projects/:id/stack` — Get project-stack JSON
- `PUT /api/projects/:id/stack` — Put project-stack JSON draft
- `POST /api/projects/:id/stack/apply` — Enable wanted[] then provision resources (never prod UUID)
- `POST /api/projects/:id/stack/diff` — Diff draft vs applied stack
- `POST /api/projects/:id/stack/rollback` — Roll back last applied stack revision
- `GET /api/projects/:id/edge/status` — Edge (tunnel/DNS) hookup status
- `POST /api/projects/:id/edge/hookup` — Hook up edge using existing Cloudflare secrets
- `GET /api/resources` — Fleet resource snapshot
- `GET /metrics` — Prometheus metrics

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

# Agent prompt — domain_manager

Cloudflare DNS records (CRUD per zone + project). Pairs with tunnel_manager for public hostnames.

Reach this service through the conductor proxy with a JWT from `POST /api/auth/login` or a service token.

Base: `{VERB} {CONDUCTOR}/api/services/domain_manager{path}`

Provider note: CLOUDFLARE_API_TOKEN. SKIP_CLOUDFLARE=1 for tests.

## Endpoints

- `POST /api/v1/dns/records` — Create a DNS record
- `GET /api/v1/dns/records` — List DNS records
- `GET /api/v1/dns/records/:id` — Get a record
- `PATCH /api/v1/dns/records/:id` — Update a record
- `DELETE /api/v1/dns/records/:id` — Delete a record

Do not hit production project `ea370977-3aff-4c76-95a6-a0c50fd2bce7` from e2e.
email/sms/slack/push are queued; outbound send disabled.

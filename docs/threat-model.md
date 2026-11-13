# Threat model (high level)

High-level attack surface for **aerekos-cloud** as a self-hosted control plane. Tighten controls per deployment using [`PRODUCTION.md`](../PRODUCTION.md). Detailed abuse cases land in wave **W14**; pen-test findings stay out of the public mirror until coordinated disclosure.

## Assets worth protecting

| Asset | Why it matters |
|-------|----------------|
| Conductor API + dashboard | Orchestration, project data, user sessions |
| JWT / app credentials / worker tokens | Cross-service auth and tenant boundaries |
| `secrets_manager` + KMS material | Third-party and platform secrets |
| SQLite / Postgres control DB | Projects, IAM, stack revisions, audit |
| Worker hosts + Docker socket | Arbitrary code execution if compromised |
| Object storage (`storage_manager`) | Application data, backups, Icarus corpus |
| Icarus tool surface (`ai_manager`) | LLM-driven mutations, browse/fetch, compute |

## Trust boundaries

```
Untrusted clients ──► TLS edge / reverse proxy ──► Conductor API
                              │
                    IAM + project scope enforcement
                              │
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   Manager :31xx        Worker agent          Icarus / LLM
   (per-service)        (containers)          (tools + RAG)
```

- **Inside the boundary:** operators, registered workers, enabled manager services on the LAN/VPC.
- **Outside:** browsers and API clients on untrusted networks, malicious uploaded content, compromised dependencies, hostile web pages fetched into corpus/RAG.

## Principal threats

### Authentication and authorization

- Stolen admin JWT or long-lived app credential → full project or platform access.
- Direct `:31xx` manager ports bypassing conductor IAM when `AUTH_REQUIRED` is off.
- Default `admin`/`admin` seed in production if `ALLOW_DEFAULT_ADMIN_SEED=1`.
- Weak or placeholder `JWT_SECRET` / `KEY_MANAGER_MASTER_KEY` (fail-closed in `NODE_ENV=production`).

**Mitigations (target state):** IAM on every proxied call (W3), `AUTH_REQUIRED=true` in prod compose, short-lived tokens, rotation runbooks, rate limits on auth and inference (W14).

### Multi-tenant / project isolation

- Cross-project IDOR via missing `project_id` checks on manager APIs.
- Friends/federation preview grants wider than documented.

**Mitigations:** automated cross-tenant e2e (W19), conductor proxy as single enforcement point, audit on break-glass admin.

### Secrets and supply chain

- Secrets committed to git or mirrored OSS history.
- Vulnerable npm/container dependencies; typosquat installs.
- Leaked tokens in logs, error messages, or client-visible stack traces.

**Mitigations:** gitleaks/npm audit/Trivy in CI (W14/W16), [`SECURITY.md`](../SECURITY.md), sanitized errors, SBOM + `NOTICE` on release.

### Network and SSRF

- `crawler_manager`, web fetch, CorpusStore, or Icarus browse reaching internal IPs (`169.254.x.x`, metadata, LAN managers).
- Webhooks calling back into the conductor without HMAC verification.

**Mitigations:** SSRF allowlists and blocklists (W14), inbound webhook signing (enterprise e41), egress policies on workers.

### Worker and container escape

- Compromised workload with host Docker socket or excessive caps.
- Malicious container images from an untrusted registry.

**Mitigations:** least-privilege compose, pinned digests, registry promotion flow, separate worker trust per project where possible.

### Icarus / agent abuse

- Prompt injection via untrusted corpus or user content → tool calls that mutate infra.
- Runaway spend on external LLM APIs; unbounded tool loops.

**Mitigations:** Done-Gate / Context-Gate / ASK on mutate (W10/W18), tool sandbox scopes, spend caps and audit of tool calls.

### Availability

- Single-conductor appliance — intentional for v0.1; HA path documented in W7.
- Queue/log backpressure; killing a manager without graceful degradation.

**Mitigations:** chaos tests → `503` + `Retry-After` (W19), backup/restore drills, NATS/Loki/Prometheus backends (W6).

## Out of scope (report upstream or operator)

- Vulnerabilities in upstream Node/Docker/SQLite without a project-specific misconfiguration.
- Attacks requiring physical access to operator hardware (treat as datacenter compromise).
- Third-party SaaS (Twilio, Cloudflare, LLM vendors) except where this repo mishandles tokens or webhooks.

## Reporting

See [`SECURITY.md`](../SECURITY.md) for private vulnerability reporting and coordinated disclosure.

## Related docs

- [`PRODUCTION.md`](../PRODUCTION.md) — deployment hardening checklist
- [`docs/plans/enterprise_standards.md`](plans/enterprise_standards.md) — security practices table
- [`docs/GA_CHECKLIST.md`](GA_CHECKLIST.md) — W0–W19 release gates (W13/W14)

## GA review notes (2026-11-13)

**SSRF:** Manager outbound (browse, webhooks, Cloudflare) must use allowlists / `ToolSandbox.checkNetworkTarget`; conductor proxy does not forward arbitrary absolute URLs to the public internet.

**Rate limits:** Conductor auth and app proxy should keep existing rate-limit middleware on login and sensitive routes; document gaps as appliance-scale only.

**Error sanitization:** API errors return `{ error: { message, code, status } }` without stack traces when `NODE_ENV=production`.

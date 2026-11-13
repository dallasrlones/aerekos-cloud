# Edge providers — tunnel & DNS

> **Navigation:** [provider-seams](./provider-seams.md) · [edge_stack_pro plan](../plans/edge_stack_pro.md) · `worker/shared/edgeProviders.js`

## Resolution

| Env | Precedence |
|-----|------------|
| `EdgeProvider.create('route53')` | Explicit |
| `AEREKOS_EDGE_PROVIDER` | Primary |
| `AEREKOS_DNS_PROVIDER` | Legacy alias |
| default | `cloudflare` |

Invalid values fall back to **cloudflare** (current production path).

## Interface

```text
EdgeProvider.create(kind?)
  → cloudflare: use tunnel_manager + domain_manager Cloudflare clients
  → route53 | gcp_dns: throws EdgeProviderNotImplemented (501)

TunnelProvider (tunnel_manager)
  createTunnel(accountId, { name })
  getTunnel(accountId, tunnelId)
  putConfig(accountId, tunnelId, ingress)

DnsProvider (domain_manager)
  listZones(accountId)
  upsertRecord(zoneId, record)
  deleteRecord(zoneId, recordId)
```

Default adapters:

| Adapter | File |
|---------|------|
| Cloudflare Tunnel API | `worker/tunnel_manager/api/services/CloudflareTunnelClient.js` |
| Cloudflare DNS API | `worker/domain_manager/api/services/CloudflareDnsClient.js` |

Credentials: **never** in git — `secrets_manager` keys `cloudflare.api_token`, `cloudflare.account_id` ([edge_stack_pro](../plans/edge_stack_pro.md)).

## Stubs (reserved)

### Amazon Route 53 (`route53`)

| Capability | Notes |
|------------|-------|
| Zones | `ListHostedZonesByName` |
| Records | `ChangeResourceRecordSets` with UPSERT |
| Health checks | Future — link to `balancer_manager` |

Env placeholder: `AWS_REGION`, IAM role or access keys via secrets_manager (not implemented).

### Google Cloud DNS (`gcp_dns`)

| Capability | Notes |
|------------|-------|
| Managed zones | `dns.managedZones.list` |
| Record sets | `dns.resourceRecordSets.patch` |

Service account JSON via secrets_manager (not implemented).

## Implementation status

| Provider | Tunnel | DNS |
|----------|--------|-----|
| `cloudflare` | Implemented | Implemented |
| `route53` | Stub | Stub |
| `gcp_dns` | Stub | Stub |

## Testing

- `SKIP_CLOUDFLARE=1` — metadata CRUD only; no live API (CI).
- Live probes — setup wizard + `cloudflareReadiness.js` in shared kernel.

# VPC / multi-device networking — Headscale (locked)

> **Status:** Approved — Headscale selected; not implemented  
> **Navigation:** [Index](./README.md) · [network_manager.md](./network_manager.md) · [worker.md](./worker.md)  
> **Overlay:** [Headscale](https://github.com/juanfont/headscale) (self-hosted Tailscale control plane)

---

## Locked decisions (2026-06-06)

| Decision | Choice |
|----------|--------|
| Overlay control plane | **Headscale** (not Nebula / raw WireGuard / Tailscale SaaS) |
| Topology | **One fleet mesh** + **ACL tags per project** (not separate Headscale instances per project) |
| Worker agent | **Tailscale client** in worker compose sidecar (`tailscale/tailscale` or official image) |
| Control plane host | **prod** (conductor stack) — Headscale container + optional self-hosted DERP |
| Manager placement | **Platform tag** — managers stay on local `aerekos` Docker bridge; east-west via overlay IP |
| User workloads | **Project tag** + Layer B Docker bridge per project on each host |
| Default VPC | Auto-create **`default`** project network on project create (Layer B + Headscale ACL tag) |
| DNS | **MagicDNS** enabled — `base_domain: aerekos.internal` (e.g. `orin.aerekos.internal`) |
| North-south | **Cloudflare unchanged** — `cloudapi` / `cloud` for humans and apps |
| Pre-auth keys | Conductor mints **tagged preauth keys** on worker register; revoke on deregister |

---

## Two layers (unchanged)

| Layer | Technology | Scope |
|-------|------------|--------|
| **A — Fleet VPC** | Headscale + Tailscale (WireGuard) | prod ↔ orin ↔ oculus |
| **B — Project isolation** | `network_manager` Docker bridge | Containers on one host |

---

## Headscale best-practice architecture

```
                    ┌─────────────────────────────────┐
                    │  prod (full stack)              │
                    │  ┌─────────────┐ ┌───────────┐ │
                    │  │  conductor  │ │ headscale │ │
                    │  └──────┬──────┘ └─────┬─────┘ │
                    │         │              │       │
                    │  ┌──────▼──────────────▼─────┐ │
                    │  │  tailscale (platform tag)  │ │
                    │  └────────────────────────────┘ │
                    └──────────────┬────────────────────┘
                                   │ 100.x overlay
              ┌────────────────────┼────────────────────┐
              │                    │                    │
     ┌────────▼────────┐  ┌────────▼────────┐  ┌───────▼───────┐
     │ orin (worker)   │  │ oculus (worker) │  │ dev-mini      │
     │ tailscale       │  │ tailscale       │  │ tailscale     │
     │ tag:project-*   │  │ tag:project-*   │  │               │
     │ ai_manager…     │  │                 │  │               │
     └─────────────────┘  └─────────────────┘  └───────────────┘

  Public: cloud.aerekos.com / cloudapi  (Cloudflare — NOT replaced)
```

### ACL tags (HuJSON policy)

```json
// Simplified — real policy in infra/headscale/acl.hujson
{
  "tagOwners": {
    "tag:platform": ["tag:admin"],
    "tag:project":  ["tag:admin"],
    "tag:worker":   ["autogroup:member"]
  },
  "acls": [
    { "action": "accept", "src": ["tag:platform"], "dst": ["tag:worker:*"] },
    { "action": "accept", "src": ["tag:project:*"], "dst": ["tag:project:*:*"] },
    { "action": "accept", "src": ["tag:worker"], "dst": ["tag:platform:*"] }
  ]
}
```

- **`tag:platform`** — prod managers, conductor (orin reaches `conductor.aerekos.internal:3300`)
- **`tag:project:{project_id}`** — workers hosting that project's compute/DB/AI
- **`tag:worker`** — all registered workers (baseline)

Project isolation: workers only get `tag:project:{id}` for projects they're assigned to.

### Pre-auth key flow (worker registration)

```
1. Worker POST /api/workers/register (existing WORKER_TOKEN)
2. Conductor → Headscale API: create preauth key
   { tags: ["tag:worker", "tag:project:…"], ephemeral: false, reusable: false }
3. Return key once to worker (or inject via env on next deploy)
4. Worker tailscale sidecar: tailscale up --login-server=$HEADSCALE_URL --authkey=$KEY
5. Conductor stores node_id mapping on Worker row
6. On deregister: Headscale delete node + expire key
```

### MagicDNS & service discovery

| Hostname | Resolves to |
|----------|-------------|
| `conductor.aerekos.internal` | prod overlay IP |
| `orin.aerekos.internal` | orin overlay IP |
| `ai-manager.orin.aerekos.internal` | orin + route (or conductor registry port map) |

**Replaces:** hardcoded `SERVICE_DIRECT_HOSTS` and LAN `192.168.x` URLs over time (migrate in VPC-4).

### Security best practices

- Headscale **admin API/UI** — LAN or Cloudflare Access only; **never** public without auth
- Headscale API key in **secrets_manager** (`headscale.api_key`)
- **No Tailscale SaaS** — `login-server` points only to your Headscale
- Self-hosted **DERP** on prod (optional phase) for NAT traversal when UDP blocked
- **MTU** — test on Orin/Jetson; may need `tailscale set --advertise-exit-node` off initially
- Audit: log preauth key create/revoke in conductor audit log (E5)

### Compose layout (target)

```yaml
# prod: docker-compose.full.yml (generated)
headscale:
  image: headscale/headscale:stable
  volumes: [./infra/headscale:/etc/headscale]
  ports: ["127.0.0.1:8080:8080"]  # not public

# each worker: worker/docker-compose.yml
tailscale:
  image: tailscale/tailscale:stable
  network_mode: host  # or cap NET_ADMIN
  environment:
    TS_AUTHKEY: ${TAILSCALE_AUTHKEY}
    TS_EXTRA_ARGS: --login-server=https://headscale.prod.aerekos.internal:8080 --accept-dns=true
  volumes: [tailscale-state:/var/lib/tailscale]
```

---

## Default VPC behavior

### Project create (conductor)

1. Create Layer B: `network_manager` → `default` bridge on assigned workers  
2. Create Layer A: add `tag:project:{id}` to Headscale ACL (or pre-provision tag)  
3. Store `project.default_network_id` + `project.headscale_tag`  
4. Setup wizard shows VPC ✅  

### Service enable / compute / db

- Attach containers to project Docker network (Layer B)  
- Service registry advertises **overlay** `host:port` for cross-host calls (Layer A)  

---

## Implementation phases

> **Todos:** [MASTER_TODOS.md](./MASTER_TODOS.md) · **lock-11**

| Phase | ID | Deliverable |
|-------|-----|-------------|
| **VPC-0** | cc-vpc-1 | Default project Docker network on project create |
| **VPC-1** | cc-vpc-2 | compute_manager + db_manager auto-attach to project bridge |
| **HS-0** | cc-hs-1 | Headscale server on prod + config + secrets_manager API key |
| **HS-1** | cc-hs-2 | ACL HuJSON (platform / project / worker tags) |
| **HS-2** | cc-hs-3 | Conductor HeadscaleService — preauth keys on worker register |
| **HS-3** | cc-hs-4 | Tailscale sidecar on worker compose + deploy env contract |
| **HS-4** | cc-hs-5 | MagicDNS `aerekos.internal` + conductor service registry overlay URLs |
| **HS-5** | cc-hs-6 | Self-hosted DERP on prod (NAT fallback) |
| **HS-6** | cc-hs-7 | Node revoke on worker deregister; key rotation runbook |
| **VPC-3** | cc-vpc-4 | Deprecate `SERVICE_DIRECT_HOSTS` / LAN URLs → overlay hostnames |
| **VPC-4** | cc-vpc-5 | network_manager security groups + Headscale ACL sync |
| **HS-7** | cc-hs-8 | Setup wizard + `aerekos vpc status` connectivity probes |
| **HS-8** | cc-hs-9 | `docs/runbooks/headscale.md` + DEPLOYMENT.md Orin overlay migration |

### Checklist

- [ ] **cc-vpc-1** Default network on project create (+ cc-project-1 hook)
- [ ] **cc-vpc-2** compute + db auto-attach project bridge
- [ ] **cc-vpc-3** Headscale on prod + ACL + preauth + sidecar (umbrella)
- [ ] **cc-vpc-4** Overlay service registry; deprecate SERVICE_DIRECT_HOSTS
- [ ] **cc-vpc-5** Security groups + wizard connectivity probes
- [ ] **cc-hs-1** Headscale server + secrets_manager API key
- [ ] **cc-hs-2** ACL HuJSON tags
- [ ] **cc-hs-3** HeadscaleService preauth on worker register
- [ ] **cc-hs-4** tailscale sidecar worker compose
- [ ] **cc-hs-5** MagicDNS aerekos.internal
- [ ] **cc-hs-6** Self-hosted DERP
- [ ] **cc-hs-7** Node revoke + rotation runbook
- [ ] **cc-hs-8** VPC wizard + `aerekos vpc status`
- [ ] **cc-hs-9** runbooks/headscale.md + DEPLOYMENT migration
- [ ] **lock-11** Fleet VPC = Headscale + Tailscale + ACL per project

---

## What stays the same

- **Cloudflare** for public dashboard/API  
- **Orin** may use overlay HTTP to conductor (fixes TLS-to-cloudapi issue) — validate on hardware  
- **auth_manager / ARNs** — unrelated to overlay; apps still use `cloudapi`  

---

## Console & CLI

- **VPC** screen under Networking (enhance `network_manager` or dedicated tab): nodes, tags, ACL status, connectivity matrix  
- Setup wizard: "Join fleet network" step on worker + project create  
- CLI:

```bash
aerekos vpc status                    # mesh health, nodes, tags
aerekos vpc nodes --project $PID
aerekos vpc preauth create --worker $ID   # admin/debug
```

---

## Links

- Cursor todos: `cc-vpc-*`, `cc-hs-*`
- [service_setup_wizard.md](./service_setup_wizard.md)
- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- Headscale docs: https://headscale.net/

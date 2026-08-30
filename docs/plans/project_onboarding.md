# Project onboarding — default stack (AWS/GCP Getting Started)

> **AWS analog:** Default VPC + “Getting started” resource wizard on account create  
> **GCP analog:** Default project + enabled APIs checklist  
> **Navigation:** [service_setup_wizard.md](./service_setup_wizard.md) · [conductor.md](./conductor.md) · [MASTER_TODOS.md](./MASTER_TODOS.md)

---

## Problem

Projects are created empty; all 34 managers seed `enabled: 0`. New users see an empty dashboard with no guided path — unlike AWS/GCP first-run experiences.

---

## Target behavior

### On `POST /api/projects` (cc-project-1)

1. Create project row (existing)
2. **Auto-create default network** — `network_manager` default bridge + Headscale tag placeholder ([vpc_network.md](./vpc_network.md) cc-vpc-1)
3. Initialize setup status record: `{ core_stack: 'not_started' }`
4. Return `setup_url` / wizard deep link

### Optional “Enable core stack” (cc-project-2)

Console checkbox on create (default **on** for new orgs):

```
key_manager → secrets_manager → auth_manager → storage_manager
```

- Enable services in dependency order via existing enablement API
- Run readiness probes from [service_setup_wizard.md](./service_setup_wizard.md)
- Do **not** auto-create secrets in prod without user confirmation (MASTER_KEY, signing secret)

### Dashboard (cc-project-3)

- Project card shows **setup %** (enabled + probed / core stack size)
- CTA: "Finish setup" → ProjectDetails stack wizard (cc-wizard-4)

### CLI (cc-project-4)

```bash
aerekos project create --name dev --enable-core
aerekos project setup status --project $PID
aerekos project setup run --project $PID --stack core
```

---

## Production checklist

| ID | Task |
|----|------|
| cc-project-1 | Hook project create → default VPC/network |
| cc-project-2 | Enable core stack toggle + ordered enablement |
| cc-project-3 | Dashboard setup % badge |
| cc-project-4 | CLI `project create --enable-core` parity |

### Conductor implementation

- [ ] `ProjectService.create` — after insert, call `NetworkProvisioner.ensureDefault(projectId)`
- [ ] `SetupReadinessService.getProjectProgress(projectId)` — aggregate service setup states
- [ ] `POST /api/projects/:id/enable-stack` — body `{ stack: 'core' | 'full' }`
- [ ] ProjectDetails: "Recommended stack" wizard UI
- [ ] Audit log: stack enable events

---

## Stacks (catalog-driven)

| Stack | Services |
|-------|----------|
| **core** | key_manager, secrets_manager, auth_manager, storage_manager |
| **ai** | core + ai_manager (requires GPU worker) |
| **edge** | secrets_manager + tunnel_manager + domain_manager ([edge_stack_pro.md](./edge_stack_pro.md)) |
| **full** | All non-deferred managers user selects |

---

## Links

- [service_setup_wizard.md](./service_setup_wizard.md)
- [milestone_m1.md](./milestone_m1.md) — cc-project-2/3 in M1

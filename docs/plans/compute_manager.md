# compute_manager — aerekos Compute (our Kubernetes)

**Port:** 3100 · **Peer:** Kubernetes control plane (not ECS) · **Category:** Compute · **Tier:** GA (orchestrator)

**Navigation:** [← db_manager](./db_manager.md) · [Index](./README.md) · [queue_manager →](./queue_manager.md)  
**ADR:** [004-aerekos-compute-orchestrator.md](../adr/004-aerekos-compute-orchestrator.md)  
**Platform auth:** [platform_app_access.md](./platform_app_access.md)  
**Standards:** [enterprise_standards.md](./enterprise_standards.md)

---

## Summary

**aerekos Compute** is our Kubernetes-class orchestrator: declarative `Deployment` resources, continuous reconcile, RollingUpdate/Recreate with progress-deadline abort, pause/resume/rollback by revision. Docker is the v0.1.0 **node agent** only (pluggable later). Project ≈ namespace; stack revisions are the IaC view.

APIs: `/api/v1/deployments/*` (primary), `/api/v1/tasks/*` (legacy task CRUD + workload helpers).

## Current state

| Area | Status |
|------|--------|
| Implementation | DeploymentController + deploymentSpec |
| Console UI | ComputeManager + ServiceGuide |
| Tests | deploymentController.test.js, desiredState.test.js |
| Direct-port auth | AUTH_REQUIRED — see [auth-required.md](../runbooks/auth-required.md) |
| Project scoping | Yes |

### Known gaps (honest)

- No kubectl-compat / CRDs / multi-cluster
- `COMPUTE_E2E_DOCKER=1` required for live dockerode apply; default unit path uses `SKIP_DOCKER`
- Fleet placement across workers is still thin

## App access

**Candidate:** Yes — adopt [platform_app_access.md](./platform_app_access.md).

| Field | Value |
|-------|-------|
| ARN | `arn:aerekos:{pid}:compute:task/{name}` |
| Scopes | compute:Run, compute:Stop, compute:Describe |

- [ ] Generate ARN on resource create
- [ ] `requireAuth` + `requireResource` on app-callable routes
- [ ] Register scopes in `docs/catalog.js`
- [ ] Console "App access" snippet
- [ ] e2e: credential scoped invoke

## Setup wizard

- [ ] Add `setup` metadata to `docs/catalog.js` (summary, dependencies, probes, wizardSteps)
- [ ] Readiness probes + first-resource step for this manager
- [ ] ManagerConsole / bespoke screen: Setup tab when incomplete
- [ ] `aerekos setup compute_manager --status` matches console — [service_setup_wizard.md](./service_setup_wizard.md)

## CLI & click ops parity

- [ ] `aerekos compute_manager …` — list/create/get/update/delete per [enterprise_standards.md](./enterprise_standards.md)
- [ ] Console action bar mirrors CLI commands
- [ ] `aerekos info compute_manager` shows endpoints, scopes, examples
- [ ] "Copy CLI" on every console mutation

---

## Production tasks

- [ ] ARN on task template / named task profiles
- [ ] requireAuth on all routes
- [ ] requireResource for run/stop
- [ ] Document SKIP_DOCKER for CI only

---

## Links

- Worker scaffold: [worker/compute_manager/plan.md](../../worker/compute_manager/plan.md)
- Service doc: [docs/services/compute_manager.md](../services/compute_manager.md)
- Deploy: [DEPLOYMENT.md](../../DEPLOYMENT.md)

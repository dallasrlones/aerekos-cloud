# ADR 004 — aerekos Compute (our Kubernetes)

**Status:** Accepted · **Date:** 2026-11-13

## Context

`compute_manager` was ECS-analog task CRUD plus a journal-style desired-state stub. Product intent ([wants #2](../../../wants.md)): aerekos ships **its own Kubernetes-class orchestrator** — declarative API, controllers, rollouts, project isolation — clean enough for OSS. We will not vendor kube-apiserver/etcd for v0.1.0.

## Decision

1. **Control plane** lives in `compute_manager`: resource types `Deployment`, `ReplicaSet`, `Pod` (aerekos API; K8s mapping documented).
2. **Project ≈ namespace.** Stack revisions (`StackService`) are the IaC view of compute resources.
3. **Node agent** on workers applies Pod specs. v0.1.0 runtime = Docker (dockerode); interface is pluggable.
4. **Controllers** continuously reconcile; RollingUpdate / Recreate; progress deadline → abort; pause / resume / rollback by revision.
5. **No kubectl-compat** in v0.1.0. Services/Ingress stay in network/domain managers but are referenceable from status.
6. SoR = compute DB + conductor project store — not etcd.

## Consequences

- Console + OpenAPI + Icarus IDE use Deployment nouns end-to-end.
- GA requires unit controller tests + `COMPUTE_E2E_DOCKER=1` (or documented skip only in CI without Docker).
- Multi-cluster / CRDs / kubectl shim are explicitly out of v0.1.0.

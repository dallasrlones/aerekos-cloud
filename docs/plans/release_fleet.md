# Release & fleet updater — production plan

> **AWS analog:** SSM Patch Manager + CodeDeploy · **GCP analog:** GKE rollout + Artifact Registry  
> **Navigation:** [conductor.md](./conductor.md) · [worker.md](./worker.md) · [MASTER_TODOS.md](./MASTER_TODOS.md)

---

## Summary

Built-in release server: `ReleaseService` publishes version bundles; device `aerekos-updater` sidecars poll `UpdateService.decide` and redeploy. `agentAuth` gates release reads. **Code exists** — production gap is verification, rollback, and ops runbooks.

## Current state

| Component | Path | Status |
|-----------|------|--------|
| Publish API | `conductor/api/routes/releases.js` | Implemented |
| Release store | `conductor/api/services/ReleaseService.js` | Implemented |
| Update decision | `conductor/api/services/UpdateService.js` | Implemented |
| Agent auth | `conductor/api/middleware/agentAuth.js` | Implemented |
| Updater sidecar | `updater/` + compose on prod/worker | Deployed |
| CI publish | `scripts/release/publish.sh`, `.github/workflows/deploy.yml` | Present |
| Console | Devices UI version display | Partial |

---

## Production checklist (release-fleet-*)

### Publish pipeline (release-fleet-1)

- [ ] **release-fleet-1a** Document publish flow: tag → `publish.sh` → `ReleaseService.publish(version, bundle, notes)`
- [ ] **release-fleet-1b** CI: deploy workflow calls publish on successful build; artifact immutability (E44)
- [ ] **release-fleet-1c** Bundle manifest: git SHA, image digests, compatible worker roles
- [ ] **release-fleet-1d** `GET /api/releases` + `GET /api/releases/latest` — admin + agentAuth

### Fleet update loop (release-fleet-2)

- [ ] **release-fleet-2a** Updater poll interval + backoff documented in DEPLOYMENT.md
- [ ] **release-fleet-2b** `UpdateService.decide(hostname, current)` — one-shot update flag from conductor
- [ ] **release-fleet-2c** Worker route `POST /api/workers/:id/request-update` — admin trigger
- [ ] **release-fleet-2d** Verify prod + Orin sidecars pull bundle and restart compose
- [ ] **release-fleet-2e** Updater logs → logs_manager shipper

### Security & audit (release-fleet-3)

- [ ] **release-fleet-3a** `agentAuth` — only registered workers + admins read bundles
- [ ] **release-fleet-3b** Audit log (E5): who published, who triggered fleet update
- [ ] **release-fleet-3c** Bundle signature or SHA verification before apply (best practice)
- [ ] **release-fleet-3d** Rate limit release download endpoints

### Console & ops (release-fleet-4)

- [ ] **release-fleet-4a** Devices UI: current vs latest version, drift badge
- [ ] **release-fleet-4b** "Request update" button → `UpdateService.requestUpdate`
- [ ] **release-fleet-4c** Pin worker to version (skip auto-update)
- [ ] **release-fleet-4d** Rollback runbook: republish previous bundle + force update

### Quality gate (release-fleet-5)

- [ ] **release-fleet-5a** Post-update: run e2e Tier 1–4 against fleet before marking healthy
- [ ] **release-fleet-5b** Failed update → sidecar reports status; conductor alert (cc-alerts-1)
- [ ] **release-fleet-5c** Canary: update one worker before full fleet (optional M2)

---

## CLI parity

```bash
aerekos releases list
aerekos releases publish --version 1.2.3 --notes "…"
aerekos fleet status                    # version drift per worker
aerekos fleet update --worker orin      # request one-shot update
aerekos fleet pin --worker orin --version 1.2.2
```

---

## Links

- [DEPLOYMENT.md](../../DEPLOYMENT.md)
- [conductor.md](./conductor.md) Phase F
- Cursor todos: `release-fleet-1` … `release-fleet-5`

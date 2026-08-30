# Service setup wizard — onboarding for every manager

> **Status:** Not started  
> **Navigation:** [Index](./README.md) · [enterprise_standards.md](./enterprise_standards.md) · [global_search.md](./global_search.md)  
> **Goal:** If someone has **never used a service**, the console tells them what it does and walks them through setup — including **dependencies**, **configuration**, and **connected/configured** status (AWS Getting Started / GCP setup wizards).

---

## Problem today

- Services seed **`enabled: 0`** — user must know to enable in ProjectDetails or ManagerConsole
- ManagerConsole "Getting started" is one paragraph — no dependency graph, no config checks
- `needsKeys` exists in `docs/catalog.js` but is **not shown** in the UI
- No guided path: key_manager → secrets_manager → ai_manager, etc.
- Bespoke screens (AI Manager, Storage) assume you already know the stack

---

## Target UX (AWS / GCP style)

Every service console opens with a **Setup** tab (or full-screen wizard when never configured):

```
┌──────────────────────────────────────────────────────────────┐
│  AI Services                                    [Setup ●] [Ops]│
├──────────────────────────────────────────────────────────────┤
│  What it does                                                 │
│  Run LLM, embeddings, TTS & STT on GPU workers (like Bedrock). │
│                                                               │
│  Setup progress                          Step 2 of 5          │
│  ████████░░░░░░░░░░░░  40%                                    │
├──────────────────────────────────────────────────────────────┤
│  Dependencies                                                 │
│  ✅ auth_manager        Connected · signing secret in KMS     │
│  ✅ key_manager         Running on prod                       │
│  ⚠️  secrets_manager    Enabled · configure conductor secret │
│  ❌ Service enabled     Enable for project "development"      │
│  ○  GPU worker          Deploy ai_manager to Orin            │
├──────────────────────────────────────────────────────────────┤
│  [ Fix secrets_manager ]  [ Enable AI Services ]  [ Next → ] │
└──────────────────────────────────────────────────────────────┘
```

### Wizard steps (config-driven per service)

| Step | Purpose |
|------|---------|
| **1. Overview** | What it does, AWS analog, 30-second video/text, link to docs |
| **2. Dependencies** | Required services + secrets; live status (connected / missing / misconfigured) |
| **3. Enable & deploy** | Enable for project, pick worker if needed (GPU, KMS host) |
| **4. Configure** | Store keys in secrets_manager, env vars, provider tokens (or "deferred") |
| **5. First resource** | Create first bucket / endpoint / database / repo |
| **6. Test** | Run health + sample API call; show green check |
| **7. App access** | ARN + credential wizard (when app-access manager) |

Status icons:
- **✅ Connected** — dependency enabled, health OK, config probe passed  
- **⚠️ Misconfigured** — running but probe failed (e.g. wrong SECRETS_MANAGER_URL on Orin)  
- **❌ Missing** — not enabled or not deployed  
- **○ Deferred** — third-party keys not required yet (SMTP, Slack, etc.)

---

## Architecture

### 1. Catalog metadata (source of truth)

Extend `docs/catalog.js` per manager:

```js
{
  name: 'ai_manager',
  setup: {
    summary: 'GPU AI: LLM, embeddings, TTS, STT on worker nodes.',
    awsAnalog: 'Amazon Bedrock + Polly + Transcribe',
    docPath: 'services/ai_manager.md',
    dependencies: [
      { service: 'auth_manager', required: true, reason: 'API authentication' },
      { service: 'key_manager', required: true, reason: 'KMS for signing secrets' },
      { service: 'secrets_manager', required: true, reason: 'conductor.client_secret, auth signing' },
    ],
    secrets: [
      { name: 'conductor.client_secret', optional: false, desc: 'auth_manager conductor client' },
    ],
    workerHints: [{ label: 'GPU', resource: 'gpu', preferHost: 'orin' }],
    readinessProbes: [
      { id: 'ollama', label: 'Ollama reachable', path: '/api/v1/llm/status' },
      { id: 'auth', label: 'auth_manager token mint', type: 'conductor-internal' },
    ],
    wizardSteps: ['overview', 'dependencies', 'enable', 'configure', 'first-resource', 'test', 'app-access'],
    firstResource: { action: 'seed-local', label: 'Set up local GPU endpoints' },
    deferredKeys: null,
  },
}
```

Sync to `conductor/app/services/serviceCatalog.js` via `scripts/sync-service-catalog.mjs` (new) or import from generated JSON.

### 2. Conductor readiness API

```
GET /api/services/:name/setup?project_id=
→ {
    service, project_id,
    progress: { completed: 2, total: 5, percent: 40 },
    dependencies: [
      { service: 'auth_manager', status: 'connected'|'misconfigured'|'missing'|'deferred',
        message: '…', fixRoute: 'authManager', fixAction: 'wizard' }
    ],
    secrets: [{ name, status, message }],
    probes: [{ id, ok, latency_ms, error }],
    enabled: boolean,
    deployed: boolean,
    wizardComplete: boolean
  }

GET /api/setup/graph
→ dependency DAG for all services (for E52 / global enablement order)
```

Implementation: `conductor/api/services/SetupReadinessService.js` — parallel health + enable checks + optional probe proxy.

### 3. UI components

| Component | Role |
|-----------|------|
| `ServiceSetupWizard.jsx` | Multi-step modal / full-page wizard |
| `DependencyChecklist.jsx` | Rows with status + fix buttons |
| `SetupProgressBar.jsx` | % from completed steps |
| `FirstResourceStep.jsx` | Delegates to manager-specific forms |
| `SetupTab` on ManagerConsole | Default tab when `!wizardComplete` |

**Entry points:**
- ManagerConsole → **Setup** tab first visit
- Bespoke screens → banner "Finish setup" if dependencies fail
- Dashboard service card → "Set up" badge when incomplete
- Global search → actions "Set up AI Services"
- ProjectDetails → "Enable stack" ordered wizard

### 4. CLI parity

```bash
aerekos setup ai_manager --project $PID           # run wizard in terminal
aerekos setup ai_manager --status --project $PID  # JSON readiness only
aerekos setup graph                               # dependency order
aerekos setup fix auth_manager --project $PID       # run fix for one dependency
```

---

## Dependency graph (initial)

| Service | Requires |
|---------|----------|
| key_manager | — (foundation) |
| secrets_manager | key_manager |
| auth_manager | secrets_manager |
| storage_manager | key_manager |
| db_manager | compute_manager (optional), network_manager (optional) |
| ai_manager | auth_manager, secrets_manager, key_manager, GPU worker |
| compute_manager | worker online |
| git_manager | storage (optional), auth_manager |
| webhook_manager | — |
| queue_manager | — |
| email/sms/slack | secrets_manager + **deferred** provider keys |
| tunnel_manager, domain_manager, cdn_manager | secrets_manager (`cloudflare.api_token`, `cloudflare.account_id`) — [edge_stack_pro.md](./edge_stack_pro.md) |

Enable order for "full stack" button: `key_manager → secrets_manager → auth_manager → …`

---

## Implementation phases

> **Todos:** `cc-wizard-1` … `cc-wizard-5` · [MASTER_TODOS.md](./MASTER_TODOS.md) · [project_onboarding.md](./project_onboarding.md)

### Phase 1 — Metadata + readiness API (cc-wizard-1) **M1**

- [ ] **cc-wizard-1** Add `setup` block to `docs/catalog.js` for all 34 managers (minimal: summary, dependencies, wizardSteps)
- [ ] `SetupReadinessService` + `GET /api/services/:name/setup`
- [ ] `GET /api/setup/graph`
- [ ] Unit tests for dependency resolution

### Phase 2 — Generic wizard UI (cc-wizard-2) **M1**

- [ ] **cc-wizard-2** `ServiceSetupWizard` + `DependencyChecklist` components
- [ ] ManagerConsole: Setup tab; auto-show wizard when first visit / not complete
- [ ] "Fix" buttons navigate to dependency service wizard or ProjectDetails enable
- [ ] Store `setupWizardComplete_{service}_{projectId}` in localStorage + server flag optional

### Phase 3 — P1 manager wizards (cc-wizard-3)

- [ ] **cc-wizard-3** **key_manager** — MASTER_KEY check, create first key
- [ ] **secrets_manager** — key_manager dep, create first secret
- [ ] **auth_manager** — bootstrap signing secret, test token mint
- [ ] **ai_manager** — deps, enable on Orin, seed-local, test LLM, app-access intro
- [ ] **storage_manager** — deps, first bucket
- [ ] **db_manager** — deps, provision first DB
- [ ] **compute_manager** — first task smoke
- [ ] **edge stack** — Connect Cloudflare → first tunnel → DNS CNAME → hostname test ([edge_stack_pro.md](./edge_stack_pro.md))

### Phase 4 — Dashboard + search integration (cc-wizard-4)

- [ ] **cc-wizard-4** Service cards show setup % badge (ties to cc-project-3)
- [ ] ProjectDetails "Enable recommended stack" wizard
- [ ] global_search actions: "Set up {service}"
- [ ] Link to post-E52 dependency graph visualization

### Phase 5 — CLI + docs (cc-wizard-5)

- [ ] **cc-wizard-5** `aerekos setup {service}` interactive wizard
- [ ] `make docs` includes setup section per service
- [ ] Runbook: Orin misconfiguration probes (LAN vs cloudapi)

---

## Per-manager plan hook

Each `docs/plans/{manager}.md` gets:

```markdown
## Setup wizard
- [ ] Catalog `setup` metadata
- [ ] Readiness probes defined
- [ ] First-resource step implemented
- [ ] CLI `aerekos setup {manager}`
```

Regenerate via `node scripts/gen-manager-plans.mjs` after script update.

---

## Definition of done (platform)

- [ ] Every manager has `setup` metadata in catalog
- [ ] ManagerConsole shows Setup tab with live dependency status
- [ ] P1 managers have working first-resource + test steps
- [ ] Misconfiguration shows **actionable fix** (not just red text)
- [ ] CLI `aerekos setup --status` matches console
- [ ] New user can go from zero → working AI endpoint without reading docs

---

## Links

- [post-e52](./README.md) — merged into this plan (dependency enablement wizard)
- [global_search.md](./global_search.md) — "Set up X" actions
- [worker.md](./worker.md) — Orin/GPU worker hints
- `conductor/app/screens/ManagerConsole/ManagerConsole.jsx` — current minimal getting started

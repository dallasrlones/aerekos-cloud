# Global search — AWS / GCP-style console search

> **Status:** Not started — header search is a non-interactive placeholder today (`editable={false}` in `Header.jsx`)  
> **Todos:** `cc-search-1` · `cc-search-2` · `cc-search-3` · `cc-search-4` — [MASTER_TODOS.md](./MASTER_TODOS.md)  
> **Navigation:** [Index](./README.md) · [conductor.md](./conductor.md) · [milestone_m1.md](./milestone_m1.md)

---

## Problem

The center search bar in the header looks like AWS/GCP global search but **does not open or accept input**. Users expect:

- Click the bar → search palette opens  
- **⌘K / Ctrl+K** (GCP) or focus + type (AWS)  
- Results grouped by category with keyboard navigation  
- Jump to services, resources, and common actions  

---

## Target UX (AWS + GCP hybrid)

```
┌─────────────────────────────────────────────────────────────┐
│  🔍  Search services, resources, and actions…          ⌘K   │
└─────────────────────────────────────────────────────────────┘
         │ click or shortcut
         ▼
┌─────────────────────────────────────────────────────────────┐
│  🔍  llm                                                      │
├─────────────────────────────────────────────────────────────┤
│  Services                                                   │
│    › AI Manager — Machine Learning & AI                     │
│    › API Gateway — Networking & Delivery                    │
├─────────────────────────────────────────────────────────────┤
│  Resources (project: development)                           │
│    › arn:…:ai:llm:endpoint/my-prod-llm                      │
│    › Bucket uploads                                         │
├─────────────────────────────────────────────────────────────┤
│  Actions                                                    │
│    › Create AI endpoint                                     │
│    › Create bucket                                          │
│    › View credentials                                       │
├─────────────────────────────────────────────────────────────┤
│  Recent                                                     │
│    › AI Manager                                             │
│    › Object Storage › uploads                               │
└─────────────────────────────────────────────────────────────┘
```

### Behaviors (match AWS/GCP)

| Behavior | AWS analog | GCP analog |
|----------|------------|------------|
| Click search bar | Opens search overlay | Opens command palette |
| ⌘K / Ctrl+K | — | Opens palette globally |
| Arrow keys + Enter | Navigate results | Navigate results |
| Esc | Close | Close |
| Service results | "Services" section | "Products" |
| Resource results | Resource search (per region) | "Resources" in project |
| Actions | "Features" / create shortcuts | "Actions" |
| Recent | Recent services | Recent pages |
| Scoped to project | Region scoping | Project scoping via ProjectSwitcher |

---

## Implementation phases

### Phase 1 — Clickable shell (cc-search-1) **M1**

- [ ] **cc-search-1** Remove `editable={false}` from header search; whole bar is `Pressable` → opens modal
- [ ] New component `GlobalSearch` / `CommandPalette` (modal overlay, centered, max-width ~640px)
- [ ] Auto-focus input when modal opens
- [ ] **⌘K / Ctrl+K** listener on web (`Platform.OS === 'web'`)
- [ ] Esc closes; click backdrop closes
- [ ] Empty state: "Search services, resources, and actions" + recent (localStorage)

**Files:** `conductor/app/components/GlobalSearch/`, `Header.jsx`, `App.js` (keyboard listener)

### Phase 2 — Static index (cc-search-2) **M1**

- [ ] **cc-search-2** Index `SERVICE_CATALOG` from `serviceCatalog.js` — label, name, category, route, description
- [ ] Index common **actions** map: `{ id, label, route, params?, keywords[] }`
  - Create bucket, create database, create key, AI Manager, enable service, **Set up {service}** (→ setup wizard)
- [ ] Fuzzy match (simple: lowercase includes, or `fuse.js` if already in deps)
- [ ] Result groups: **Services** | **Actions** | **Recent**
- [ ] Selecting service → `navigation.navigate(route || 'managerConsole', { serviceName })`
- [ ] Highlight matched substring; show category breadcrumb

### Phase 3 — Resource search (cc-search-3)

- [ ] **cc-search-3** `GET /api/search?q=&project_id=&limit=` — aggregator on conductor
- [ ] Query enabled managers in parallel (or indexed snapshot):
  - ai_manager endpoints/providers
  - storage_manager buckets
  - db_manager databases
  - secrets (names only, no values)
  - git repos
  - compute tasks
  - queue names
- [ ] Return unified hits: `{ type, arn?, name, service, path, subtitle }`
- [ ] Palette section **Resources** with ARN copy on hover
- [ ] After app-access: resource hits include `invoke_url`

### Phase 4 — Polish (cc-search-4)

- [ ] **cc-search-4** Recent searches + recent navigations (localStorage, per user)
- [ ] "Create …" action suggestions when query matches verb (`create`, `new`, `add`)
- [ ] Keyboard: ↑↓ move, Enter select, Tab switch sections
- [ ] Mobile: full-screen sheet instead of modal
- [ ] `aerekos search "llm"` CLI parity (optional, P8)
- [ ] Analytics event on search select (analytics_manager)

---

## CLI parity

```bash
aerekos search "llm" --project $PID
aerekos search --services          # list indexable services
```

---

## Definition of done

- [ ] Header search bar clickable on web and mobile
- [ ] ⌘K / Ctrl+K opens palette on web
- [ ] All `SERVICE_CATALOG` services findable by label and keyword
- [ ] At least 10 common actions indexed (create flows)
- [ ] Phase 3 resource search for core managers (ai, storage, db, git)
- [ ] Recent items persist across sessions
- [ ] Documented in console help / Settings

---

## Links

- `conductor/app/components/Header/Header.jsx` — line 82 `editable={false}` today
- `conductor/app/services/serviceCatalog.js` — static service index
- [conductor.md](./conductor.md) — Phase I or new phase for search API

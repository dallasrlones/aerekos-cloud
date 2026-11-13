# Service guide UX building blocks

AWS-console-style product pages in the conductor app use two shared components:

- `conductor/app/components/ServiceGuide/ServiceGuide.jsx`
- `conductor/app/components/ServiceGuide/DependencyChecklist.jsx`

Dependency metadata lives in `conductor/app/services/serviceDeps.js` (`SERVICE_REQUIRES`, `resolveMissing`, `getDepsForService`).

## ServiceGuide props

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | Panel title |
| `analogue` | string | e.g. `Amazon S3` — shown as "Like …" |
| `blurb` | string | One-paragraph overview |
| `whenToUse` | string[] | Bullet list |
| `prerequisites` | string[] | Bullet list |
| `examples` | `{ label, code }[]` | Monospace snippets |
| `deps` | checklist rows | Passed to `DependencyChecklist` |
| `onSetup` | fn | Primary setup CTA |
| `onSetupDep` | fn(dep) | Per-dependency navigation |
| `onEnableAllDeps` | fn | Batch enable (uses setup API) |
| `children` | node | Extra content below examples |

## DependencyChecklist props

| Prop | Type | Description |
|------|------|-------------|
| `deps` | `{ id, name?, status, why? }[]` | Rows; `status` `satisfied` / `ready` / `connected` = green |
| `onSetup` | fn(dep) | "Set up" on missing rows |
| `onEnableAll` | fn | "Enable automatically" when any missing |

## BFF: provision-deps

```
POST /api/services/provision-deps
{
  "project_id": "<uuid>",
  "service": "storage_manager",
  "dry_run": true
}
```

Returns `{ plan: { enable_order, steps, missing, summary, dry_run } }`. Actual enable remains `POST /api/setup/enable` with `with_dependencies: true`; non–dry-run on provision-deps is reserved for a future batch path.

## Exemplar screen

`StorageManager` wires `ServiceGuide` at the top of the scroll view. Copy the pattern for other managers:

```jsx
import { ServiceGuide } from '../../components/ServiceGuide/ServiceGuide';
import { getDepsForService, resolveMissing } from '../../services/serviceDeps';
```

Use `setupService.getServiceSetup(name, projectId)` to merge live dependency status from the setup wizard.

#!/usr/bin/env node
/**
 * Generate docs/GA_MATURITY.md from docs/catalog.js + e2e/catalog.js.
 * Optional depth notes align with ../aerekos-cloud-STATUS.md §5 (sibling inventory).
 *
 * Run: node scripts/oss/gen-ga-maturity.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');
const require = createRequire(import.meta.url);

const { managers, STATUS_LABEL } = require(path.join(repoRoot, 'docs/catalog.js'));
const { ALL_MANAGERS, P4_MANAGERS, PORTS } = require(path.join(repoRoot, 'e2e/catalog.js'));

/** @type {Set<string>} */
const p4Names = new Set(P4_MANAGERS.map((p) => p.name));

/** Implemented services with incomplete or operator-only dataplane (OSS: call Preview). */
const PREVIEW = new Set([
  'download_manager' // media ingest / qBittorrent path operator-only; see STATUS inventory
]);

/** Conductor-adjacent features (not in manager catalog). */
const PLATFORM_PREVIEW = [
  { feature: 'Friends federation (peer attach)', doc: 'docs/plans/friends_federation.md', maturity: 'preview' },
  { feature: 'Project Friends (same conductor)', doc: 'docs/guides/icarus.md', maturity: 'GA' }
];

function maturityTier(m) {
  if (m.status === 'needs-keys') return 'needs-keys';
  if (PREVIEW.has(m.name)) return 'preview';
  if (m.status === 'implemented') return 'GA';
  return m.status || 'unknown';
}

function e2eNote(name) {
  const inAll = ALL_MANAGERS.includes(name);
  const inP4 = p4Names.has(name);
  if (!inAll) return '—';
  if (inP4) return 'liveness + P4 CRUD round-trip';
  return 'liveness / proxy';
}

const rows = managers
  .map((m) => ({
    name: m.name,
    port: m.port ?? PORTS[m.name] ?? '—',
    category: m.category,
    catalog: m.status,
    tier: maturityTier(m),
    e2e: e2eNote(m.name),
    keys: m.needsKeys ? 'yes' : '—'
  }))
  .sort((a, b) => String(a.port).localeCompare(String(b.port), undefined, { numeric: true }));

const ga = rows.filter((r) => r.tier === 'GA').length;
const nk = rows.filter((r) => r.tier === 'needs-keys').length;
const prev = rows.filter((r) => r.tier === 'preview').length;

const table = [
  '| Manager | Port | Category | Catalog | **Maturity** | E2E (`e2e/catalog.js`) | Provider keys |',
  '|---------|------|----------|---------|--------------|-------------------------|---------------|',
  ...rows.map(
    (r) =>
      `| \`${r.name}\` | ${r.port} | ${r.category} | ${r.catalog} | **${r.tier}** | ${r.e2e} | ${r.keys} |`
  )
].join('\n');

const body = `# GA maturity matrix (managers)

Single-page view for **public OSS** and contributors: which managers are generally available (**GA**), which need provider secrets (**needs-keys**), and which are **preview** (metadata/control plane without a full dataplane).

**Sources (regenerate — do not hand-edit the table):**

- \`docs/catalog.js\` — catalog \`status\` and \`needsKeys\` notes (\`STATUS_LABEL\`: ${JSON.stringify(STATUS_LABEL)})
- \`e2e/catalog.js\` — \`ALL_MANAGERS\` (proxy liveness) and \`P4_MANAGERS\` (SQLite CRUD round-trip)
- Fleet depth inventory: [\`../aerekos-cloud-STATUS.md\`](../aerekos-cloud-STATUS.md) §5 (sibling doc; not shipped in mirror)

\`\`\`bash
node scripts/oss/gen-ga-maturity.mjs
\`\`\`

## Legend

| Maturity | Meaning |
|----------|---------|
| **GA** | Catalog \`implemented\`. Safe to enable for projects; e2e exercises the manager through the conductor proxy. |
| **needs-keys** | Catalog \`needs-keys\`. CRUD and proxy work; live calls to external providers require secrets (store in \`secrets_manager\`, never in git). |
| **preview** | Control plane present but dataplane incomplete, parked, or operator-only — not marketed as full cloud parity. |

Counts: **${ga}** GA · **${nk}** needs-keys · **${prev}** preview (managers only).

## Manager matrix

${table}

## Conductor features (not managers)

| Feature | Maturity | Doc |
|---------|----------|-----|
${PLATFORM_PREVIEW.map((p) => `| ${p.feature} | **${p.maturity}** | [\`${p.doc}\`](${p.doc}) |`).join('\n')}

## Hygiene

- README \`/api/v1/info\` status vs docs: \`node scripts/oss/fix-stub-readmes.js\`
- Mirror scrub before publish: \`scripts/oss/check-mirror-scrub.sh\` (see [\`docs/OSS_SCRUB.md\`](OSS_SCRUB.md))
`;

const out = path.join(repoRoot, 'docs/GA_MATURITY.md');
fs.writeFileSync(out, body);
console.log(`Wrote ${out} (${rows.length} managers)`);

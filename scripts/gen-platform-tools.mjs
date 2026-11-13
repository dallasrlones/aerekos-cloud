#!/usr/bin/env node
/**
 * Generate platform tool schemas, Laya packs corpus, and e2e matrix stubs from catalog.
 * Hook from `make docs` / gen-docs.mjs.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'worker/ai_manager/api/generated');
fs.mkdirSync(outDir, { recursive: true });

let catalog = { managers: [] };
try {
  const mod = await import(path.join(root, 'docs/catalog.js'));
  catalog = mod.default || mod.catalog || mod;
} catch {
  try {
    catalog = JSON.parse(fs.readFileSync(path.join(root, 'docs/site/catalog.json'), 'utf8'));
  } catch {
    catalog = { managers: [] };
  }
}

const managers = catalog.managers || catalog.services || [];
const tools = [
  { name: 'aerekos_status', lane: ['user', 'manager'], mutating: false },
  { name: 'aerekos_search_docs', lane: ['user', 'manager'], mutating: false },
  { name: 'aerekos_call', lane: ['manager'], mutating: true },
  { name: 'iac_schema', lane: ['user', 'manager'], mutating: false },
  { name: 'iac_put', lane: ['manager'], mutating: true },
  { name: 'iac_diff', lane: ['user', 'manager'], mutating: false },
  { name: 'iac_apply', lane: ['manager'], mutating: true },
  { name: 'iac_rollback', lane: ['manager'], mutating: true },
  { name: 'data_api_apply', lane: ['manager'], mutating: true },
  { name: 'project_services', lane: ['user', 'manager'], mutating: false },
  { name: 'update_work', lane: ['manager'], mutating: true },
  { name: 'rag_ingest', lane: ['manager', 'user'], mutating: true },
];

const layaPacks = [
  'lane', 'flow_pick', 'intake_next', 'hitl_risk', 'config_vs_code',
  'finetune_pick', 'info_path', 'done_gate', 'plan_split', 'regroup',
];

const flows = [
  'new_project_app', 'new_worker_fleet', 'safe_self_update',
  'safe_deps_upgrade', 'iac_spool', 'browse_learn_ingest', 'heal_computer_browser',
];

const generated = {
  generated_at: new Date().toISOString(),
  managers: managers.map((m) => m.name || m),
  tools,
  laya_packs: layaPacks,
  flows,
  e2e_matrix: [
    ...tools.map((t) => ({ id: `tool_${t.name}`, kind: 'platform_tool', tool: t.name })),
    ...layaPacks.map((p) => ({ id: `laya_${p}`, kind: 'laya', pack: p })),
    ...flows.map((f) => ({ id: `flow_${f}`, kind: 'flow', flow: f })),
    { id: 'ide_live_file', kind: 'ide', script: 'e2e/icarus-platform-matrix.js' },
    { id: 'services_map', kind: 'ide', script: 'e2e/icarus-platform-matrix.js' },
    { id: 'pr_review_path', kind: 'spine', script: 'worker/ai_manager/tests/unit/icarus.e2e.test.js' },
    { id: 'layer_spine', kind: 'spine' },
    { id: 'hitl_prod_deny', kind: 'hitl' },
    { id: 'info_rag', kind: 'rag' },
    { id: 'steer_neo4j', kind: 'spine' },
    { id: 'safe_self_update_live', kind: 'flow' },
    { id: 'safe_deps_upgrade_live', kind: 'flow' },
    { id: 'queue_worker_live', kind: 'ootb' },
    { id: 'iac_rollback', kind: 'iac' },
    { id: 'heal_resume', kind: 'ops' },
    { id: 'docs_sdk_drift', kind: 'docs', script: 'make docs' },
  ],
  stack_keys: ['wanted', 'data_apis', 'routes', 'functions', 'queues', 'tunnels', 'compute', 'defaults'],
};

fs.writeFileSync(path.join(outDir, 'platformTools.json'), JSON.stringify(generated, null, 2));
fs.writeFileSync(
  path.join(outDir, 'layaDecisionPacks.json'),
  JSON.stringify({ packs: layaPacks, flows, generated_at: generated.generated_at }, null, 2),
);
fs.writeFileSync(
  path.join(outDir, 'platformCorpus.md'),
  `# Platform corpus (generated)\n\nManagers: ${generated.managers.slice(0, 40).join(', ')}\n\nTools: ${tools.map((t) => t.name).join(', ')}\n\nFlows: ${flows.join(', ')}\n`,
);

const mcpOut = path.join(root, 'worker/mcp_manager/api/schemas/icarusPlatformTools.generated.json');
fs.mkdirSync(path.dirname(mcpOut), { recursive: true });
fs.writeFileSync(mcpOut, JSON.stringify({
  generated_at: generated.generated_at,
  note: 'Import alongside platformTools.js; do not hand-edit',
  tools: tools.map((t) => ({
    name: `icarus.${t.name}`,
    description: `Icarus platform tool ${t.name}`,
    mutating: t.mutating,
    lane: t.lane,
  })),
}, null, 2));

console.log(`gen-platform-tools: wrote ${outDir}`);
console.log(`gen-platform-tools: wrote ${mcpOut}`);

#!/usr/bin/env node
/**
 * Fail CI if manager names diverge across catalog / ports / seed / UI catalog.
 * Run: node scripts/check-catalog.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const { managers } = require(path.join(root, 'docs/catalog.js'));
const ports = require(path.join(root, 'conductor/api/config/managerServicePorts.js'));
const { ALL_MANAGERS: e2eManagers } = require(path.join(root, 'e2e/catalog.js'));

const catalogNames = new Set(managers.map((m) => m.name));
const portNames = new Set(Object.keys(ports));

function namesFromSeed() {
  const src = fs.readFileSync(path.join(root, 'conductor/scripts/seedServices.js'), 'utf8');
  const names = [...src.matchAll(/name:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  return new Set(names.filter((n) => n.endsWith('_manager') || n === 'code_as_infra'));
}

function namesFromUi() {
  const src = fs.readFileSync(path.join(root, 'conductor/app/services/serviceCatalog.js'), 'utf8');
  const names = [...src.matchAll(/name:\s*'([a-z0-9_]+)'/g)].map((m) => m[1]);
  return new Set(names);
}

function diff(a, b) {
  return [...a].filter((x) => !b.has(x)).sort();
}

const seed = namesFromSeed();
const ui = namesFromUi();
const e2e = new Set(e2eManagers);
let failed = false;
const pairs = [
  ['catalog vs ports', catalogNames, portNames],
  ['ports vs catalog', portNames, catalogNames],
  ['catalog vs seed', catalogNames, seed],
  ['seed vs catalog', seed, catalogNames],
  ['catalog vs UI', catalogNames, ui],
  ['UI vs catalog', ui, catalogNames],
  ['catalog vs e2e', catalogNames, e2e],
  ['e2e vs catalog', e2e, catalogNames],
];
for (const [label, a, b] of pairs) {
  const extra = diff(a, b);
  if (extra.length) {
    failed = true;
    console.error(`Mismatch (${label}): ${extra.join(', ')}`);
  }
}

const { listClickOpsServiceNames } = require(path.join(root, 'worker/shared/clickOpsCatalog.js'));
const clickOps = new Set(listClickOpsServiceNames());
const missingClickOps = diff(catalogNames, clickOps);
if (missingClickOps.length) {
  failed = true;
  console.error(`Mismatch (catalog vs click-ops): ${missingClickOps.join(', ')}`);
}

if (failed) process.exit(1);
console.log(`ok: ${catalogNames.size} managers aligned across catalog, ports, seed, UI, e2e, click-ops`);

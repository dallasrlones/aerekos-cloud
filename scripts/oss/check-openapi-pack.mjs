#!/usr/bin/env node
/**
 * Verify docs/openapi pack currency for worker managers.
 *
 * Usage:
 *   node scripts/oss/check-openapi-pack.mjs
 *   node scripts/oss/check-openapi-pack.mjs --check-generated
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '../..');
const openapiDir = path.join(repoRoot, 'docs/openapi');
const workerDir = path.join(repoRoot, 'worker');
const parkedPath = path.join(openapiDir, 'PARKED_GAPS.md');
const generatedPath = path.join(openapiDir, 'ga-managers.generated.yaml');
const genScript = path.join(repoRoot, 'scripts/oss/gen-openapi-from-catalog.mjs');

const checkGenerated = process.argv.includes('--check-generated');

function listWorkers() {
  return fs
    .readdirSync(workerDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .filter((n) => n.endsWith('_manager') || n === 'code_as_infra')
    .sort();
}

function parseParkedGaps(md) {
  const names = new Set();
  for (const line of md.split('\n')) {
    const m = line.match(/^\|\s*`([a-z0-9_]+)`\s*\|/);
    if (m) names.add(m[1]);
  }
  return names;
}

const workers = listWorkers();
const parked = fs.existsSync(parkedPath)
  ? parseParkedGaps(fs.readFileSync(parkedPath, 'utf8'))
  : new Set();

const missing = [];
const covered = [];
const parkedHit = [];

for (const name of workers) {
  const pack = path.join(openapiDir, `${name}.yaml`);
  if (fs.existsSync(pack)) {
    covered.push(name);
  } else if (parked.has(name)) {
    parkedHit.push(name);
  } else {
    missing.push(name);
  }
}

let generatedOk = null;
if (checkGenerated) {
  const before = fs.readFileSync(generatedPath, 'utf8');
  const tmp = path.join(openapiDir, `.ga-managers.check.${process.pid}.yaml`);
  // Run generator into a temp location by patching: copy, regen, compare, restore
  fs.copyFileSync(generatedPath, tmp);
  const run = spawnSync(process.execPath, [genScript], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (run.status !== 0) {
    console.error(run.stdout || '');
    console.error(run.stderr || '');
    fs.copyFileSync(tmp, generatedPath);
    fs.unlinkSync(tmp);
    console.error('FAIL: gen-openapi-from-catalog.mjs exited non-zero');
    process.exit(1);
  }
  const after = fs.readFileSync(generatedPath, 'utf8');
  generatedOk = before === after;
  if (!generatedOk) {
    // restore committed/current content so check is non-mutating
    fs.writeFileSync(generatedPath, before, 'utf8');
  }
  fs.unlinkSync(tmp);
}

console.log(`workers: ${workers.length}`);
console.log(`pack files: ${covered.length}`);
console.log(`parked: ${parkedHit.length}${parkedHit.length ? ` (${parkedHit.join(', ')})` : ''}`);
if (missing.length) {
  console.error(`MISSING docs/openapi/<name>.yaml (and not in PARKED_GAPS.md):`);
  for (const n of missing) console.error(`  - ${n}`);
}
if (checkGenerated) {
  if (generatedOk) {
    console.log('ga-managers.generated.yaml: matches regen');
  } else {
    console.error('ga-managers.generated.yaml: STALE — run: node scripts/oss/gen-openapi-from-catalog.mjs');
  }
}

const fail = missing.length > 0 || (checkGenerated && !generatedOk);
process.exit(fail ? 1 : 0);

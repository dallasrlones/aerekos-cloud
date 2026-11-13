#!/usr/bin/env node
'use strict';

/**
 * Rewrite README stub /info rows to match worker route files (api/routes/index.js).
 *
 *   node scripts/oss/fix-stub-readmes.js           # report only
 *   node scripts/oss/fix-stub-readmes.js --write   # apply patches
 */

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '../..');
const workerDir = path.join(repoRoot, 'worker');
const write = process.argv.includes('--write');

const STUB_RE =
  /\|\s*GET\s*\|\s*\/api\/v1\/info\s*\|\s*Metadata\s*\(`status:\s*"stub"`[^|]*\)\s*\|/;

function readInfoStatus(serviceDir) {
  const candidates = [
    path.join(serviceDir, 'api/routes/index.js'),
    path.join(serviceDir, 'api/routes.js'),
    path.join(serviceDir, 'routes/index.js')
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const m = src.match(/status:\s*['"]([^'"]+)['"]/);
    if (m) return { status: m[1], file: path.relative(repoRoot, file) };
  }
  return null;
}

function infoTableLine(status) {
  const label =
    status === 'active'
      ? `Metadata (\`status: "active"\` — see live \`/api/v1/info\`)`
      : `Metadata (\`status: "${status}"\`)`;
  return `| GET | /api/v1/info | ${label} |`;
}

let touched = 0;
let scanned = 0;

for (const name of fs.readdirSync(workerDir)) {
  const serviceDir = path.join(workerDir, name);
  if (!fs.statSync(serviceDir).isDirectory()) continue;
  const readme = path.join(serviceDir, 'README.md');
  if (!fs.existsSync(readme)) continue;

  scanned++;
  const text = fs.readFileSync(readme, 'utf8');
  if (!STUB_RE.test(text)) continue;

  const info = readInfoStatus(serviceDir);
  if (!info) {
    console.warn(`skip ${name}: no /info status in routes`);
    continue;
  }
  if (info.status === 'stub') continue;

  const next = text.replace(STUB_RE, infoTableLine(info.status));
  if (next === text) continue;

  touched++;
  console.log(`${write ? 'fix' : 'would fix'} ${name}: stub -> ${info.status} (${info.file})`);
  if (write) fs.writeFileSync(readme, next);
}

console.log(`Scanned ${scanned} READMEs; ${touched} ${write ? 'updated' : 'candidate(s)'}.`);
if (touched && !write) {
  console.log('Re-run with --write to apply.');
  process.exitCode = 0;
}

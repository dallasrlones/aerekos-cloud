#!/usr/bin/env node
/** Assert generated platform tools matrix exists and lists required tools. */
const fs = require('fs');
const path = require('path');

const p = path.join(__dirname, '../worker/ai_manager/api/generated/platformTools.json');
if (!fs.existsSync(p)) {
  console.error('MISSING', p, '— run node scripts/gen-platform-tools.mjs');
  process.exit(1);
}
const j = JSON.parse(fs.readFileSync(p, 'utf8'));
const names = (j.tools || []).map((t) => t.name);
for (const need of ['aerekos_status', 'iac_apply', 'data_api_apply', 'project_services', 'update_work']) {
  if (!names.includes(need)) {
    console.error('missing tool', need);
    process.exit(1);
  }
}
if (!(j.e2e_matrix || []).length) {
  console.error('empty e2e_matrix');
  process.exit(1);
}
console.log('OK platform-tools-matrix', names.length, 'tools', j.e2e_matrix.length, 'rows');

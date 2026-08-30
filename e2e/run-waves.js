'use strict';

/**
 * Production-plan docker-local waves. Each script no-ops when CONDUCTOR_URL is unset.
 */
const { spawnSync } = require('child_process');
const path = require('path');

const WAVES = [
  'wave-iac-hookup.js',
  'wave-auth-lock.js',
  'wave-notify.js',
  'wave-vpc-fleet.js',
  'wave-edge-hookup.js',
  'wave-git-cicd.js',
  'wave-ops.js',
  'wave-data-graphql.js',
  'wave-quota-storage.js',
  'wave-search-cli.js',
];

function main() {
  const root = __dirname;
  let failed = 0;
  for (const file of WAVES) {
    console.log(`\n==> ${file}`);
    const r = spawnSync(process.execPath, [path.join(root, file)], {
      stdio: 'inherit',
      env: process.env,
    });
    if (r.status !== 0) {
      failed += 1;
      console.error(`FAIL ${file} exit=${r.status}`);
    }
  }
  if (failed) {
    console.error(`\n${failed}/${WAVES.length} waves failed`);
    process.exit(1);
  }
  console.log(`\n${WAVES.length} waves passed`);
}

main();

'use strict';

/**
 * HELP / --help must list the Discover + Operate verbs operators rely on.
 * Guards against HELP drifting behind implemented commands (cliParity hygiene).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { spawnSync } = require('child_process');

const CLI = path.join(__dirname, '..', 'bin', 'aerekos.js');

function helpOutput(args) {
  const r = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  assert.strictEqual(r.status, 0, `CLI exited ${r.status}: ${r.stderr || r.stdout}`);
  return `${r.stdout || ''}${r.stderr || ''}`;
}

const EXPECTED_VERBS = [
  'login',
  'logout',
  'whoami',
  'config',
  'services',
  'workers',
  'managers',
  'info',
  'metrics',
  'health',
  'backup',
  'iac',
  'edge',
  'setup',
  'vpc',
  'systems',
  'graphql',
  'search',
  'intelligence',
  'agents',
  'connectors',
  'call',
];

test('aerekos --help lists expected verbs', () => {
  const text = helpOutput(['--help']);
  for (const verb of EXPECTED_VERBS) {
    assert.match(text, new RegExp(`\\b${verb}\\b`), `missing verb in --help: ${verb}`);
  }
});

test('aerekos help lists expected verbs', () => {
  const text = helpOutput(['help']);
  for (const verb of EXPECTED_VERBS) {
    assert.match(text, new RegExp(`\\b${verb}\\b`), `missing verb in help: ${verb}`);
  }
});

test('aerekos -h mentions health Operate line', () => {
  const text = helpOutput(['-h']);
  assert.match(text, /health \[service\]/);
  assert.match(text, /Generic proxy/);
});

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isKeeperProject, PROD_UUID } = require('./cleanup-project');
const { KEEPER_MARKERS } = require('../worker/ai_manager/api/services/SafeDepsUpgradeService');

test('keeper projects are never deleted by cleanup sweep', () => {
  assert.equal(isKeeperProject({ id: PROD_UUID, name: 'prod-mini' }), true);
  assert.equal(isKeeperProject({ id: 'x', name: 'aerekos-tv' }), true);
  assert.equal(isKeeperProject({ id: 'x', name: 'friends-demo' }), true);
  assert.equal(isKeeperProject({ id: 'x', name: 'my-storage-sandbox' }), true);
  assert.equal(isKeeperProject({ id: 'x', name: 'e2e-platform-20250101' }), false);
  assert.equal(isKeeperProject({ id: 'x', name: 'e2e-wave2-demo' }), false);
});

test('KEEPER_MARKERS align with SafeDepsUpgradeService', () => {
  assert.ok(KEEPER_MARKERS.includes('aerekos-tv'));
  assert.ok(KEEPER_MARKERS.includes(PROD_UUID));
  for (const marker of KEEPER_MARKERS) {
    assert.equal(isKeeperProject({ id: marker, name: `e2e-${marker}` }), true);
  }
});

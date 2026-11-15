'use strict';

/**
 * Production must refuse SKIP_GIT (metadata-only fake). Mirrors index.js assertNoSkipFakes.
 */
describe('no prod mocks / SKIP_GIT', () => {
  const { assertNoSkipFakes } = require('../../../shared/prodGuards');

  const withEnv = (env, fn) => {
    const prev = { ...process.env };
    Object.assign(process.env, env);
    try {
      return fn();
    } finally {
      for (const k of Object.keys(process.env)) {
        if (!(k in prev)) delete process.env[k];
      }
      Object.assign(process.env, prev);
    }
  };

  test('assertNoSkipFakes allows SKIP_GIT outside production', () => {
    withEnv({ NODE_ENV: 'test', SKIP_GIT: '1' }, () => {
      expect(() => assertNoSkipFakes({ extra: ['SKIP_GIT'] })).not.toThrow();
    });
  });

  test('index.js wires assertNoSkipFakes with SKIP_GIT', () => {
    const src = require('fs').readFileSync(
      require('path').join(__dirname, '../../index.js'),
      'utf8'
    );
    expect(src).toMatch(/assertNoSkipFakes/);
    expect(src).toMatch(/SKIP_GIT/);
  });
});

'use strict';

const { enrichSecret, buildSecretArn, SCOPE_BY_ACTION } = require('../../api/services/SecretArn');

const PROJECT = '11111111-1111-4111-8111-111111111111';

describe('SecretArn', () => {
  test('buildSecretArn includes project and name', () => {
    const a = buildSecretArn(PROJECT, 'my-secret');
    expect(a).toContain(PROJECT);
    expect(a).toContain('my-secret');
    expect(a).toMatch(/secrets/);
  });

  test('enrichSecret adds arn and invoke_scope', () => {
    const out = enrichSecret({
      id: '1',
      project_id: PROJECT,
      name: 'tok',
    });
    expect(out.arn).toBeTruthy();
    expect(out.invoke_scope).toEqual(SCOPE_BY_ACTION);
    expect(out.invoke_scope.get).toBe('secrets:GetValue');
  });

  test('enrichSecret preserves existing arn', () => {
    const out = enrichSecret({
      project_id: PROJECT,
      name: 'n',
      arn: 'arn:aerekos:custom',
    });
    expect(out.arn).toBe('arn:aerekos:custom');
  });
});

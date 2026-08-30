'use strict';

const arn = require('../../shared/arn');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

describe('arn', () => {
  test('build and parse round-trip', () => {
    const raw = arn.build({
      projectId: PID,
      namespace: 'ai',
      resourceType: 'llm:endpoint',
      name: 'my-prod-llm',
    });
    expect(raw).toBe(`arn:aerekos:${PID}:ai:llm:endpoint/my-prod-llm`);
    const p = arn.parse(raw);
    expect(p).toMatchObject({
      projectId: PID,
      namespace: 'ai',
      resourceType: 'llm:endpoint',
      name: 'my-prod-llm',
    });
  });

  test('rejects invalid name', () => {
    expect(() => arn.build({ projectId: PID, namespace: 'ai', resourceType: 'bucket', name: 'BAD NAME' }))
      .toThrow('invalid resource name');
  });

  test('wildcard matches', () => {
    const exact = `arn:aerekos:${PID}:storage:bucket/uploads`;
    const pattern = `arn:aerekos:${PID}:storage:bucket/*`;
    expect(arn.matches(pattern, exact)).toBe(true);
    expect(arn.matches(exact, exact)).toBe(true);
    expect(arn.matches(pattern, `arn:aerekos:${PID}:storage:bucket/other`)).toBe(true);
    expect(arn.matches(pattern, `arn:aerekos:${PID}:db:database/x`)).toBe(false);
  });

  test('isAllowed checks list', () => {
    const resource = `arn:aerekos:${PID}:ai:llm:endpoint/foo`;
    expect(arn.isAllowed([`arn:aerekos:${PID}:ai:llm:endpoint/*`], resource)).toBe(true);
    expect(arn.isAllowed([`arn:aerekos:${PID}:ai:tts:endpoint/*`], resource)).toBe(false);
  });
});

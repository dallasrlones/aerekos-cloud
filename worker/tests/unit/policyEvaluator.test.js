const { evaluatePolicies, validatePolicyResources } = require('../../shared/policyEvaluator');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';
const BKT = `arn:aerekos:${PID}:storage:bucket/uploads`;

describe('policyEvaluator', () => {
  test('allow when action and resource match', () => {
    const r = evaluatePolicies(
      [{ effect: 'allow', name: 's3-read', document: { actions: ['storage:ListBucket'], resources: [BKT] } }],
      { action: 'storage:ListBucket', resourceArn: BKT },
    );
    expect(r.allowed).toBe(true);
  });

  test('deny beats allow', () => {
    const r = evaluatePolicies(
      [
        { effect: 'allow', document: { actions: ['storage:*'], resources: ['*'] } },
        { effect: 'deny', document: { actions: ['storage:DeleteObject'], resources: [BKT] } },
      ],
      { action: 'storage:DeleteObject', resourceArn: BKT },
    );
    expect(r.allowed).toBe(false);
    expect(r.matched).toBe('deny');
  });

  test('default deny', () => {
    const r = evaluatePolicies(
      [{ effect: 'allow', document: { actions: ['ai:InvokeLlm'], resources: ['*'] } }],
      { action: 'storage:ListBucket', resourceArn: BKT },
    );
    expect(r.allowed).toBe(false);
  });

  test('validatePolicyResources rejects bad ARN', () => {
    const bad = validatePolicyResources({ resources: ['not-an-arn'] });
    expect(bad).toContain('not-an-arn');
  });

  test('validatePolicyResources accepts wildcard', () => {
    expect(validatePolicyResources({ resources: ['*'] })).toEqual([]);
  });
});

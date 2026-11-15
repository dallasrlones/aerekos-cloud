'use strict';

jest.mock('../../api/models', () => ({
  IamRole: {},
  IamPolicy: {},
  IamRolePolicyBinding: {},
}));

const { IamService } = require('../../api/services/IamService');

function makeStore() {
  const tables = { roles: [], policies: [], bindings: [] };
  let seq = 1;
  const nextId = () => `id-${seq++}`;

  const match = (row, where) =>
    Object.entries(where || {}).every(([k, v]) => row[k] === v);

  const model = (key) => ({
    async findAll({ where } = {}) {
      return tables[key].filter((r) => match(r, where));
    },
    async create(data) {
      const row = { id: nextId(), ...data, created_at: 't', updated_at: 't' };
      tables[key].push(row);
      return row;
    },
    async update(id, patch) {
      const row = tables[key].find((r) => r.id === id);
      Object.assign(row, patch, { updated_at: 't2' });
      return row;
    },
    async delete(id) {
      const i = tables[key].findIndex((r) => r.id === id);
      if (i >= 0) tables[key].splice(i, 1);
    },
  });

  return {
    tables,
    IamRole: model('roles'),
    IamPolicy: model('policies'),
    IamRolePolicyBinding: model('bindings'),
  };
}

describe('IamService', () => {
  let svc;
  let store;

  beforeEach(() => {
    store = makeStore();
    svc = new IamService(store);
  });

  test('assertProjectId rejects empty', () => {
    expect(() => svc.assertProjectId('')).toThrow(/project_id/);
  });

  test('validateName rejects bad names', () => {
    expect(() => svc.validateName('1bad', 'name')).toThrow(/1-128/);
    expect(svc.validateName('ok_role', 'name')).toBe('ok_role');
  });

  test('assertEffect only allow/deny', () => {
    expect(svc.assertEffect('Allow')).toBe('allow');
    expect(() => svc.assertEffect('maybe')).toThrow(/effect/);
  });

  test('createRole / list / get / update / delete', async () => {
    const role = await svc.createRole({ project_id: 'p1', name: 'writer', description: 'd' });
    expect(role.name).toBe('writer');

    await expect(
      svc.createRole({ project_id: 'p1', name: 'writer' })
    ).rejects.toMatchObject({ status: 409 });

    const listed = await svc.listRoles('p1');
    expect(listed).toHaveLength(1);

    const got = await svc.getRole(role.id, 'p1');
    expect(got.id).toBe(role.id);

    const updated = await svc.updateRole(role.id, 'p1', { description: 'new' });
    expect(updated.description).toBe('new');

    const del = await svc.deleteRole(role.id, 'p1');
    expect(del.deleted).toBe(true);
    await expect(svc.getRole(role.id, 'p1')).rejects.toMatchObject({ status: 404 });
  });

  const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';
  const ARN = `arn:aerekos:${PID}:storage:bucket/uploads`;

  test('createPolicy validates ARN resources and stores document JSON', async () => {
    await expect(
      svc.createPolicy({
        project_id: PID,
        name: 'bad',
        effect: 'allow',
        document: { actions: ['storage:GetObject'], resources: ['not-an-arn'] },
      })
    ).rejects.toMatchObject({ code: 'INVALID_POLICY_RESOURCES', status: 400 });

    const pol = await svc.createPolicy({
      project_id: PID,
      name: 'read',
      effect: 'allow',
      document: { actions: ['storage:GetObject'], resources: [ARN] },
    });
    expect(JSON.parse(pol.document).resources).toEqual([ARN]);
  });

  test('attach / list / detach bindings', async () => {
    const role = await svc.createRole({ project_id: PID, name: 'ops' });
    const pol = await svc.createPolicy({
      project_id: PID,
      name: 'allow-get',
      effect: 'allow',
      document: { actions: ['storage:GetObject'], resources: [ARN] },
    });

    const binding = await svc.attachPolicyToRole(role.id, pol.id, PID);
    expect(binding.role_id).toBe(role.id);

    await expect(
      svc.attachPolicyToRole(role.id, pol.id, PID)
    ).rejects.toMatchObject({ status: 409 });

    const listed = await svc.listPoliciesForRole(role.id, PID);
    expect(listed.policies).toHaveLength(1);

    const detached = await svc.detachPolicyFromRole(role.id, pol.id, PID);
    expect(detached.detached).toBe(true);
  });

  test('evaluateAccess allow and explicit deny', async () => {
    const role = await svc.createRole({ project_id: PID, name: 'reader' });
    const allow = await svc.createPolicy({
      project_id: PID,
      name: 'allow-list',
      effect: 'allow',
      document: { actions: ['storage:ListBucket'], resources: [ARN] },
    });
    const deny = await svc.createPolicy({
      project_id: PID,
      name: 'deny-del',
      effect: 'deny',
      document: { actions: ['storage:DeleteObject'], resources: [ARN] },
    });
    await svc.attachPolicyToRole(role.id, allow.id, PID);
    await svc.attachPolicyToRole(role.id, deny.id, PID);

    const ok = await svc.evaluateAccess({
      project_id: PID,
      role_name: 'reader',
      action: 'storage:ListBucket',
      resource_arn: ARN,
    });
    expect(ok.allowed).toBe(true);

    const blocked = await svc.evaluateAccess({
      project_id: PID,
      role_name: 'reader',
      action: 'storage:DeleteObject',
      resource_arn: ARN,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.matched).toBe('deny');

    const missing = await svc.evaluateAccess({
      project_id: PID,
      role_name: 'nope',
      action: 'storage:ListBucket',
      resource_arn: ARN,
    });
    expect(missing.allowed).toBe(false);
    expect(missing.reason).toMatch(/role not found/);
  });

  test('actionMatches and resourceMatches wildcards', () => {
    expect(svc.actionMatches('*', 'any:thing')).toBe(true);
    expect(svc.actionMatches('storage:*', 'storage:GetObject')).toBe(true);
    expect(svc.actionMatches('storage:GetObject', 'storage:PutObject')).toBe(false);
    expect(
      svc.resourceMatches(`arn:aerekos:${PID}:storage:bucket/*`, ARN)
    ).toBe(true);
  });
});

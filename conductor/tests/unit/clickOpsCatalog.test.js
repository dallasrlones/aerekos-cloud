'use strict';

const { ALL_MANAGERS } = require('../../../e2e/catalog');
const {
  listClickOps,
  listClickOpsServiceNames,
  getClickOps,
  emptyStack,
  mergeRecords,
  removeRecords,
  sanitizeResource,
} = require('../../../worker/shared/clickOpsCatalog');

describe('clickOpsCatalog', () => {
  test('covers every manager in the e2e catalog', () => {
    const names = new Set(listClickOpsServiceNames());
    const missing = ALL_MANAGERS.filter((n) => !names.has(n));
    expect(missing).toEqual([]);
  });

  test('every op has a unique stack key per service resource', () => {
    for (const ops of listClickOps()) {
      expect(ops.name).toBeTruthy();
      expect(ops.stackKey).toBeTruthy();
      expect(ops.segment).toBeTruthy();
    }
  });

  test('empty stack includes queues, functions, data_apis and wanted', () => {
    const stack = emptyStack('p1');
    expect(stack.kind).toBe('project-stack');
    expect(Array.isArray(stack.queues)).toBe(true);
    expect(Array.isArray(stack.functions)).toBe(true);
    expect(Array.isArray(stack.data_apis)).toBe(true);
    expect(Array.isArray(stack.wanted)).toBe(true);
    expect(getClickOps('queue_manager').stackKey).toBe('queues');
    expect(getClickOps('function_manager').stackKey).toBe('functions');
  });

  test('mergeRecords upserts by name and strips secrets', () => {
    const stack = emptyStack('p1');
    const next = mergeRecords(stack, [
      { service: 'secrets_manager', resource: { name: 'smtp.password', value: 'super-secret' } },
      { service: 'queue_manager', resource: { name: 'jobs', engine: 'standard' } },
    ]);
    expect(next.secrets).toEqual([{ name: 'smtp.password' }]);
    expect(next.queues[0]).toEqual({ name: 'jobs', engine: 'standard' });
    const updated = mergeRecords(next, [
      { service: 'queue_manager', resource: { name: 'jobs', engine: 'fifo' } },
    ]);
    expect(updated.queues).toHaveLength(1);
    expect(updated.queues[0].engine).toBe('fifo');
  });

  test('removeRecords drops by name', () => {
    const stack = mergeRecords(emptyStack('p1'), [
      { service: 'function_manager', resource: { name: 'hello' } },
    ]);
    const next = removeRecords(stack, [{ service: 'function_manager', name: 'hello' }]);
    expect(next.functions).toEqual([]);
  });

  test('sanitizeResource never keeps token/password fields', () => {
    const ops = getClickOps('tunnel_manager');
    const clean = sanitizeResource(ops, { name: 'edge', token: 'cf-token', extra: 'ok' });
    expect(clean.token).toBeUndefined();
    expect(clean.extra).toBe('ok');
  });
});

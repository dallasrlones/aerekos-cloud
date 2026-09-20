'use strict';

const { parseShmSize, applyGpuHostConfig, mergeRuntimeLimits, withRuntimeSpec } = require('../../../shared/dockerGpuHostConfig');
const { DockerService } = require('../../api/services/DockerService');

describe('dockerGpuHostConfig', () => {
  test('parseShmSize accepts bytes and compose units', () => {
    expect(parseShmSize(64)).toBe(64);
    expect(parseShmSize('1g')).toBe(1073741824);
    expect(parseShmSize('512m')).toBe(536870912);
    expect(parseShmSize('')).toBeNull();
  });

  test('applyGpuHostConfig sets Runtime and ShmSize', () => {
    const host = {};
    applyGpuHostConfig(host, { runtime: 'nvidia', shm_size: '1g' });
    expect(host.Runtime).toBe('nvidia');
    expect(host.ShmSize).toBe(1073741824);
  });

  test('applyGpuHostConfig reads resource_limits', () => {
    const host = {};
    applyGpuHostConfig(host, { resource_limits: { runtime: 'nvidia', shm_size: 4096 } });
    expect(host.Runtime).toBe('nvidia');
    expect(host.ShmSize).toBe(4096);
  });

  test('mergeRuntimeLimits copies body.runtime onto limits', () => {
    const out = mergeRuntimeLimits({ runtime: 'nvidia', shm_size: '2g' }, { ram_gb: 8 });
    expect(out.runtime).toBe('nvidia');
    expect(out.shm_size).toBe('2g');
    expect(out.ram_gb).toBe(8);
  });

  test('withRuntimeSpec lifts runtime onto the fleet spec', () => {
    const spec = withRuntimeSpec({ name: 'x', image: 'img' }, { runtime: 'nvidia', shm_size: '1g' });
    expect(spec.runtime).toBe('nvidia');
    expect(spec.shm_size).toBe('1g');
    expect(spec.resource_limits.runtime).toBe('nvidia');
  });
});

describe('DockerService nvidia runtime', () => {
  test('passes runtime and shm_size to HostConfig', async () => {
    const created = [];
    const docker = {
      createContainer: async (opts) => {
        created.push(opts);
        return {
          start: async () => {},
          inspect: async () => ({ Id: 'cid', Name: '/gpu-task' }),
        };
      },
    };
    const svc = new DockerService({ docker });
    await svc.createAndStart({
      name: 'gpu-task',
      image: 'openclaw/stt-service:latest',
      runtime: 'nvidia',
      shm_size: '1g',
    });
    expect(created[0].HostConfig.Runtime).toBe('nvidia');
    expect(created[0].HostConfig.ShmSize).toBe(1073741824);
  });
});

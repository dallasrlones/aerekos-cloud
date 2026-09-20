'use strict';

const { matchNav, resolveProject } = require('../../app/utils/icarusNavCatalog');

describe('icarusNavCatalog', () => {
  const projects = [{ id: 'p1', name: 'demo' }, { id: 'p2', name: 'system' }];
  const currentProject = projects[0];

  it('maps take me to Agents', () => {
    expect(matchNav('take me to Agents').screen).toBe('aiAgents');
  });

  it('maps show me project demo containers', () => {
    const hit = matchNav("show me project demo's containers", { projects, currentProject });
    expect(hit.screen).toBe('computeManager');
    expect(hit.project.name).toBe('demo');
    expect(hit.anchor).toBe('compute-list');
  });

  it('unknown go-to asks, does not guess', () => {
    expect(matchNav('take me to the secret vault').kind).toBe('unknown');
  });

  it('denies vLLM mutate', () => {
    expect(matchNav('restart vllm').kind).toBe('deny');
  });

  it('shop phrases stay shop', () => {
    expect(matchNav('learn React latest syntax').kind).toBe('shop');
  });

  it('resolveProject by name', () => {
    expect(resolveProject('project demo env prod settings', projects).name).toBe('demo');
  });
});

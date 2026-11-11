const { getScreenFromPath, getPathFromScreen } = require('../../app/utils/screenPath');

const screenName = (pathname, options) => {
  const data = getScreenFromPath(pathname, options);
  return typeof data === 'object' && data.screen ? data.screen : data;
};

describe('getScreenFromPath', () => {
  it('maps bare /storage-manager to storageManager', () => {
    expect(getScreenFromPath('/storage-manager')).toBe('storageManager');
  });

  it('maps bare /db-manager to databaseManager', () => {
    expect(getScreenFromPath('/db-manager')).toBe('databaseManager');
  });

  it('maps bare /key-manager to keyManager', () => {
    expect(getScreenFromPath('/key-manager')).toBe('keyManager');
  });

  it('keeps /db-manager/create as createDatabase', () => {
    expect(getScreenFromPath('/db-manager/create')).toBe('createDatabase');
  });

  it('maps /compute-manager to computeManager', () => {
    expect(getScreenFromPath('/compute-manager')).toBe('computeManager');
  });

  it('maps /adonis and round-trips', () => {
    expect(getScreenFromPath('/adonis')).toBe('adonis');
    expect(getScreenFromPath('/adonis/r1/main')).toEqual({
      screen: 'adonis',
      params: { repoId: 'r1', ref: 'main' },
    });
    expect(getPathFromScreen('adonis')).toBe('/adonis');
    expect(getPathFromScreen('adonis', { repoId: 'r1', ref: 'main' })).toBe('/adonis/r1/main');
  });

  it('maps /services/iam_manager to managerConsole', () => {
    expect(screenName('/services/iam_manager')).toBe('managerConsole');
    expect(getScreenFromPath('/services/iam_manager')).toEqual({
      screen: 'managerConsole',
      params: { serviceName: 'iam_manager' },
    });
  });

  it('uses catalog route when getServiceMeta is provided', () => {
    const getServiceMeta = (name) => (name === 'iam_manager' ? { route: 'managerConsole' } : null);
    expect(screenName('/services/iam_manager', { getServiceMeta })).toBe('managerConsole');
  });

  it('round-trips navigate(storageManager) through the URL', () => {
    const path = getPathFromScreen('storageManager');
    expect(path).toBe('/storage-manager');
    expect(getScreenFromPath(path)).toBe('storageManager');
  });

  it('maps AI memory / LoRA / balancer detail screens', () => {
    expect(getScreenFromPath('/ai-manager/memory/abc')).toEqual({
      screen: 'aiMemoryForm',
      params: { memoryId: 'abc' },
    });
    expect(getScreenFromPath('/ai-manager/memory/new')).toBe('aiMemoryForm');
    expect(getScreenFromPath('/ai-manager/lora/lora-1')).toEqual({
      screen: 'aiLoraForm',
      params: { loraId: 'lora-1' },
    });
    expect(getScreenFromPath('/ai-manager/balancers/tg-9')).toEqual({
      screen: 'aiBalancerDetails',
      params: { balancerId: 'tg-9' },
    });
    expect(getPathFromScreen('aiMemoryForm', { memoryId: 'abc' })).toBe('/ai-manager/memory/abc');
    expect(getPathFromScreen('aiLoraForm', { loraId: 'lora-1' })).toBe('/ai-manager/lora/lora-1');
    expect(getPathFromScreen('aiBalancerDetails', { balancerId: 'tg-9' })).toBe('/ai-manager/balancers/tg-9');
  });

  it('maps AI Manager hub and section screens', () => {
    expect(getScreenFromPath('/services/ai_manager')).toEqual({ screen: 'aiManager', params: {} });
    expect(getScreenFromPath('/services/ai_manager/agents')).toEqual({ screen: 'aiAgents', params: {} });
    expect(getScreenFromPath('/services/ai_manager/llm')).toEqual({ screen: 'aiLlm', params: {} });
    expect(getScreenFromPath('/ai-manager/agents')).toBe('aiAgents');
    expect(getScreenFromPath('/ai-manager/memory')).toBe('aiMemory');
    expect(getPathFromScreen('aiAgents')).toBe('/services/ai_manager/agents');
    expect(getPathFromScreen('aiLlm')).toBe('/services/ai_manager/llm');
  });

  it('maps agent task detail screens', () => {
    expect(getScreenFromPath('/services/ai_manager/agents/tasks/t-9', { search: '?agent=a1' })).toEqual({
      screen: 'aiAgentTask',
      params: { taskId: 't-9', agentId: 'a1' },
    });
    expect(getScreenFromPath('/ai-manager/agents/tasks/t-9')).toEqual({
      screen: 'aiAgentTask',
      params: { taskId: 't-9', agentId: '' },
    });
    expect(getPathFromScreen('aiAgentTask', { taskId: 't-9', agentId: 'a1' }))
      .toBe('/services/ai_manager/agents/tasks/t-9?agent=a1');
  });
});

/**
 * Console URL <-> screen mapping. Bare /storage-manager, /db-manager, and
 * /key-manager must resolve to camelCase screen names (not the kebab path).
 */

/** Legacy AI Manager leaves → Icarus screens (hub retired). */
const AI_SECTION_TO_ICARUS = {
  agents: { screen: 'icarus', params: { section: 'chat' } },
  engines: { screen: 'icarusFleet', params: { section: 'fleet', tab: 'engines' } },
  endpoints: { screen: 'icarusFleet', params: { section: 'fleet', tab: 'endpoints' } },
  llm: { screen: 'icarusModels', params: { section: 'models', tab: 'llm' } },
  tts: { screen: 'icarusModels', params: { section: 'models', tab: 'tts' } },
  stt: { screen: 'icarusModels', params: { section: 'models', tab: 'stt' } },
  embeddings: { screen: 'icarusModels', params: { section: 'models', tab: 'embeddings' } },
  benchmarks: { screen: 'icarusModels', params: { section: 'models', tab: 'benchmarks' } },
  intelligence: { screen: 'icarusApps', params: { section: 'apps', tab: 'intelligence' } },
  rag: { screen: 'icarusApps', params: { section: 'apps', tab: 'rag' } },
  memory: { screen: 'icarusApps', params: { section: 'apps', tab: 'memory' } },
  jobs: { screen: 'icarusApps', params: { section: 'apps', tab: 'jobs' } },
  finetunes: { screen: 'icarusApps', params: { section: 'apps', tab: 'finetunes' } },
  access: { screen: 'icarusApps', params: { section: 'apps', tab: 'appaccess' } },
};

const AI_SECTION_SCREENS = {
  agents: 'aiAgents',
  engines: 'aiEngines',
  endpoints: 'aiEndpoints',
  llm: 'aiLlm',
  tts: 'aiTts',
  stt: 'aiStt',
  embeddings: 'aiEmbeddings',
  benchmarks: 'aiBenchmarks',
  intelligence: 'aiIntelligence',
  rag: 'aiRag',
  memory: 'aiMemory',
  jobs: 'aiJobs',
  finetunes: 'aiFinetunes',
  access: 'aiAccess',
};

const ICARUS_PATH_SCREENS = {
  fleet: { screen: 'icarusFleet', params: { section: 'fleet' } },
  models: { screen: 'icarusModels', params: { section: 'models' } },
  apps: { screen: 'icarusApps', params: { section: 'apps' } },
  skills: { screen: 'icarusSkills', params: { section: 'skills' } },
  friends: { screen: 'icarusFriends', params: { section: 'friends' } },
  federation: { screen: 'icarusFriends', params: { section: 'friends', tab: 'federation' } },
  connectors: { screen: 'icarusConnectors', params: { section: 'connectors' } },
  cron: { screen: 'icarusCron', params: { section: 'cron' } },
  advanced: { screen: 'icarusAdvanced', params: { section: 'advanced' } },
};

const BARE_SCREENS = {
  dashboard: 'dashboard',
  settings: 'settings',
  menu: 'menu',
  devices: 'devices',
  projects: 'projects',
  'key-manager': 'keyManager',
  'storage-manager': 'storageManager',
  'db-manager': 'databaseManager',
};

function queryParam(search, key) {
  if (!search) return null;
  const raw = String(search).startsWith('?') ? String(search).slice(1) : String(search);
  try {
    return new URLSearchParams(raw).get(key);
  } catch {
    return null;
  }
}

/**
 * @param {string} pathname
 * @param {{ getServiceMeta?: Function, search?: string }} [options]
 */
function getScreenFromPath(pathname, options = {}) {
  const getServiceMeta = options.getServiceMeta;
  const search = options.search || '';

  if (pathname === '/' || pathname === '') return 'dashboard';
  const parts = pathname.replace(/^\//, '').split('/');
  const firstPart = parts[0];

  if (firstPart === 'devices' && parts.length > 1) {
    return { screen: 'deviceDetails', params: { deviceId: parts[1] } };
  }

  if (firstPart === 'icarus') {
    const leaf = parts[1];
    if (!leaf) return { screen: 'icarus', params: { section: 'chat' } };
    // Icarus IDE (formerly Adonis)
    if (leaf === 'ide') {
      const params = {};
      if (parts[2]) params.repoId = parts[2];
      if (parts[3]) params.ref = parts[3];
      return Object.keys(params).length ? { screen: 'adonis', params } : 'adonis';
    }
    const mapped = ICARUS_PATH_SCREENS[leaf];
    if (mapped) {
      const tab = parts[2] || queryParam(search, 'tab') || mapped.params.tab;
      return {
        screen: mapped.screen,
        params: { ...mapped.params, ...(tab ? { tab } : {}) },
      };
    }
    return { screen: 'icarus', params: { section: 'chat' } };
  }

  if (firstPart === 'services') {
    if (parts.length > 1 && parts[1]) {
      const serviceName = parts[1].replace(/\/$/, '');
      if (serviceName === 'ai_manager') {
        if (parts[2] === 'agents' && parts[3] === 'tasks' && parts[4]) {
          return {
            screen: 'aiAgentTask',
            params: { taskId: parts[4], agentId: queryParam(search, 'agent') || '' },
          };
        }
        const leaf = parts[2];
        if (!leaf) return { screen: 'icarus', params: { section: 'chat' } };
        const icarus = AI_SECTION_TO_ICARUS[leaf];
        if (icarus) return icarus;
        return { screen: 'icarus', params: { section: 'chat' } };
      }
      const meta = typeof getServiceMeta === 'function' ? getServiceMeta(serviceName) : null;
      if (meta?.route) {
        return { screen: meta.route, params: {} };
      }
      return { screen: 'managerConsole', params: { serviceName } };
    }
    return 'dashboard';
  }

  if (firstPart === 'compute-manager') {
    if (parts[1] === 'run' || parts[1] === 'launch') {
      return 'launchContainer';
    }
    if ((parts[1] === 'tasks' || parts[1] === 'containers') && parts.length > 2) {
      return { screen: 'containerDetails', params: { containerId: parts[2], taskId: parts[2] } };
    }
    return 'computeManager';
  }

  if (firstPart === 'auth-manager') {
    if (parts[1] === 'providers' && parts[2] === 'new') {
      return 'providerForm';
    }
    if (parts[1] === 'providers' && parts.length > 2) {
      return { screen: 'providerForm', params: { providerId: parts[2] } };
    }
    if (parts[1] === 'users' && parts[2] === 'new') {
      return 'userForm';
    }
    if (parts[1] === 'users' && parts.length > 2) {
      return { screen: 'userForm', params: { userId: parts[2] } };
    }
    return 'authManager';
  }

  if (firstPart === 'ai-manager') {
    if (parts[1] === 'models' && parts.length > 2) {
      return { screen: 'aiModelDetails', params: { modelName: decodeURIComponent(parts.slice(2).join('/')) } };
    }
    if (parts[1] === 'deployment' || parts[1] === 'deployments') {
      return 'aiDeploymentDetails';
    }
    if (parts[1] === 'providers' && parts[2] === 'new') {
      return 'aiProviderForm';
    }
    if (parts[1] === 'providers' && parts.length > 2) {
      return { screen: 'aiProviderForm', params: { providerId: parts[2] } };
    }
    if (parts[1] === 'intelligence' && parts[2] === 'new') {
      return 'aiIntelligenceForm';
    }
    if (parts[1] === 'intelligence' && parts.length > 2) {
      return { screen: 'aiIntelligenceForm', params: { intelligenceId: parts[2] } };
    }
    if (parts[1] === 'rag' && parts[2] === 'new') {
      return 'aiRagForm';
    }
    if (parts[1] === 'rag' && parts.length > 2) {
      return { screen: 'aiRagForm', params: { ragId: parts[2] } };
    }
    if (parts[1] === 'memory' && parts[2] === 'new') {
      return 'aiMemoryForm';
    }
    if (parts[1] === 'memory' && parts.length > 2) {
      return { screen: 'aiMemoryForm', params: { memoryId: parts[2] } };
    }
    if (parts[1] === 'lora' && parts[2] === 'new') {
      return 'aiLoraForm';
    }
    if (parts[1] === 'lora' && parts.length > 2) {
      return { screen: 'aiLoraForm', params: { loraId: parts[2] } };
    }
    if (parts[1] === 'balancers' && parts.length > 2) {
      return { screen: 'aiBalancerDetails', params: { balancerId: decodeURIComponent(parts[2]) } };
    }
    if (parts[1] === 'agents' && parts[2] === 'tasks' && parts[3]) {
      return {
        screen: 'aiAgentTask',
        params: { taskId: parts[3], agentId: queryParam(search, 'agent') || '' },
      };
    }
    if (!parts[2] && AI_SECTION_TO_ICARUS[parts[1]]) {
      return AI_SECTION_TO_ICARUS[parts[1]];
    }
    if (!parts[2] && AI_SECTION_SCREENS[parts[1]]) {
      return AI_SECTION_TO_ICARUS[parts[1]] || { screen: 'icarus', params: { section: 'chat' } };
    }
    return { screen: 'icarus', params: { section: 'chat' } };
  }

  if (firstPart === 'api-gateway-manager') {
    return 'apiGatewayManager';
  }

  if (firstPart === 'key-manager') {
    if (parts.length > 1) {
      if (parts[1] === 'secrets' && parts[2] === 'create') {
        return 'createServiceSecret';
      }
      if (parts[1] === 'secrets' && parts.length > 2) {
        return { screen: 'serviceSecretDetails', params: { secretId: parts[2] } };
      }
      if (parts[1] === 'secrets') {
        return 'serviceSecretsList';
      }
      if (parts[1] === 'keys' && parts.length > 2) {
        return { screen: 'keyDetails', params: { keyName: parts[2] } };
      }
      if (parts[1] === 'keys') {
        return 'keysList';
      }
      if (parts[1] === 'create') {
        return 'createKey';
      }
    }
    return 'keyManager';
  }

  if (firstPart === 'db-manager') {
    if (parts.length > 1) {
      if (parts[1] === 'databases' && parts.length > 2) {
        return { screen: 'databaseDetails', params: { databaseName: parts[2] } };
      }
      if (parts[1] === 'databases') {
        return 'databasesList';
      }
      if (parts[1] === 'create') {
        return 'createDatabase';
      }
    }
    return 'databaseManager';
  }

  if (firstPart === 'storage-manager') {
    if (parts.length > 1) {
      if (parts[1] === 'projects') {
        return 'projectsList';
      }
      if (parts[1] === 'buckets' && parts.length > 3 && parts[3] === 'config') {
        const projectId = queryParam(search, 'projectId');
        return { screen: 'bucketConfig', params: { bucketName: parts[2], projectId } };
      }
      if (parts[1] === 'buckets' && parts.length > 3 && parts[2] === 'files') {
        return { screen: 'fileDetails', params: { bucketName: parts[2], key: decodeURIComponent(parts.slice(3).join('/')) } };
      }
      if (parts[1] === 'buckets' && parts.length > 2) {
        const projectId = queryParam(search, 'projectId');
        return { screen: 'bucketDetails', params: { bucketName: parts[2], projectId } };
      }
      if (parts[1] === 'buckets') {
        const projectId = queryParam(search, 'projectId');
        return { screen: 'bucketsList', params: projectId ? { projectId } : {} };
      }
    }
    return 'storageManager';
  }

  if (firstPart === 'projects' && parts.length > 1) {
    if (parts[1] === 'new' || parts[1] === 'create') {
      return { screen: 'projectForm', params: { mode: 'create' } };
    }
    if (parts[1] === 'edit' && parts.length > 2) {
      return { screen: 'projectForm', params: { mode: 'edit', projectId: parts[2] } };
    }
    return { screen: 'projectDetails', params: { projectId: parts[1] } };
  }

  if (firstPart === 'edge-manager') return 'edgeManager';
  if (firstPart === 'queue-manager') return 'queueManager';
  if (firstPart === 'webhook-manager') return 'webhookManager';
  if (firstPart === 'git-manager') return 'gitManager';
  if (firstPart === 'adonis' || firstPart === 'icarus') {
    // /icarus/ide/... redirects to Icarus IDE (formerly Adonis)
    let idx = 1;
    if (firstPart === 'icarus' && parts[1] === 'ide') idx = 2;
    const params = {};
    if (parts[idx]) params.repoId = parts[idx];
    if (parts[idx + 1]) params.ref = parts[idx + 1];
    return Object.keys(params).length ? { screen: 'adonis', params } : 'adonis';
  }
  if (firstPart === 'cicd-manager') return 'cicdManager';
  if (firstPart === 'ops' || firstPart === 'whats-broken') return 'opsTimeline';
  if (firstPart === 'registry-manager') return 'registryManager';

  if (BARE_SCREENS[firstPart]) {
    return BARE_SCREENS[firstPart];
  }
  return 'dashboard';
}

function getPathFromScreen(screen, params = {}) {
  if (screen === 'dashboard') return '/';
  if (screen === 'servicesConsole') return '/';
  if (screen === 'managerConsole' && params.serviceName) {
    return `/services/${params.serviceName}`;
  }
  if (screen === 'computeManager') return '/compute-manager';
  if (screen === 'launchContainer' || screen === 'runTask') return '/compute-manager/launch';
  if ((screen === 'containerDetails' || screen === 'taskDetails') && (params.containerId || params.taskId)) {
    return `/compute-manager/containers/${params.containerId || params.taskId}`;
  }
  if (screen === 'authManager') return '/auth-manager';
  if (screen === 'icarus') return '/icarus';
  if (screen === 'icarusFleet') {
    return params.tab ? `/icarus/fleet/${params.tab}` : '/icarus/fleet';
  }
  if (screen === 'icarusModels') {
    return params.tab ? `/icarus/models/${params.tab}` : '/icarus/models';
  }
  if (screen === 'icarusApps') {
    return params.tab ? `/icarus/apps/${params.tab}` : '/icarus/apps';
  }
  if (screen === 'icarusSkills') return '/icarus/skills';
  if (screen === 'icarusFriends') {
    if (params?.tab === 'federation') return '/icarus/federation';
    return '/icarus/friends';
  }
  if (screen === 'icarusConnectors') return '/icarus/connectors';
  if (screen === 'icarusCron') return '/icarus/cron';
  if (screen === 'icarusAdvanced') return '/icarus/advanced';
  if (screen === 'aiManager' || screen === 'aiAgents') return '/icarus';
  if (screen === 'aiAgentTask' && params.taskId) {
    const q = params.agentId ? `?agent=${encodeURIComponent(params.agentId)}` : '';
    return `/services/ai_manager/agents/tasks/${params.taskId}${q}`;
  }
  if (screen === 'aiEngines') return '/icarus/fleet/engines';
  if (screen === 'aiEndpoints') return '/icarus/fleet/endpoints';
  if (screen === 'aiLlm') return '/icarus/models/llm';
  if (screen === 'aiTts') return '/icarus/models/tts';
  if (screen === 'aiStt') return '/icarus/models/stt';
  if (screen === 'aiEmbeddings') return '/icarus/models/embeddings';
  if (screen === 'aiBenchmarks') return '/icarus/models/benchmarks';
  if (screen === 'aiIntelligence') return '/icarus/apps/intelligence';
  if (screen === 'aiRag') return '/icarus/apps/rag';
  if (screen === 'aiMemory') return '/icarus/apps/memory';
  if (screen === 'aiJobs') return '/icarus/apps/jobs';
  if (screen === 'aiFinetunes') return '/icarus/apps/finetunes';
  if (screen === 'aiAccess') return '/icarus/apps/appaccess';
  if (screen === 'aiDeploymentDetails') return '/ai-manager/deployments';
  if (screen === 'aiModelDetails' && params.modelName) {
    return `/ai-manager/models/${encodeURIComponent(params.modelName)}`;
  }
  if (screen === 'apiGatewayManager') return '/api-gateway-manager';
  if (screen === 'edgeManager') return '/edge-manager';
  if (screen === 'queueManager') return '/queue-manager';
  if (screen === 'downloadManager') return '/services/download_manager';
  if (screen === 'functionManager') return '/services/function_manager';
  if (screen === 'webhookManager') return '/webhook-manager';
  if (screen === 'gitManager') return '/git-manager';
  if (screen === 'adonis') {
    if (params.repoId && params.ref) return `/icarus/ide/${params.repoId}/${encodeURIComponent(params.ref)}`;
    if (params.repoId) return `/icarus/ide/${params.repoId}`;
    return '/icarus/ide';
  }
  if (screen === 'cicdManager') return '/cicd-manager';
  if (screen === 'opsTimeline') return '/ops';
  if (screen === 'registryManager') return '/registry-manager';
  if (screen === 'aiProviderForm' && params.providerId) {
    return `/ai-manager/providers/${params.providerId}`;
  }
  if (screen === 'aiProviderForm') {
    const q = new URLSearchParams();
    if (params.capability) q.set('capability', params.capability);
    if (params.provider) q.set('provider', params.provider);
    const qs = q.toString();
    return `/ai-manager/providers/new${qs ? `?${qs}` : ''}`;
  }
  if (screen === 'aiIntelligenceForm' && params.intelligenceId) {
    return `/ai-manager/intelligence/${params.intelligenceId}`;
  }
  if (screen === 'aiIntelligenceForm') return '/ai-manager/intelligence/new';
  if (screen === 'aiRagForm' && params.ragId) {
    return `/ai-manager/rag/${params.ragId}`;
  }
  if (screen === 'aiRagForm') return '/ai-manager/rag/new';
  if (screen === 'aiMemoryForm' && params.memoryId) {
    return `/ai-manager/memory/${params.memoryId}`;
  }
  if (screen === 'aiMemoryForm') return '/ai-manager/memory/new';
  if (screen === 'aiLoraForm' && params.loraId) {
    return `/ai-manager/lora/${params.loraId}`;
  }
  if (screen === 'aiLoraForm') return '/ai-manager/lora/new';
  if (screen === 'aiBalancerDetails' && params.balancerId) {
    return `/ai-manager/balancers/${encodeURIComponent(params.balancerId)}`;
  }
  if (screen === 'providerForm' && params.providerId) {
    return `/auth-manager/providers/${params.providerId}`;
  }
  if (screen === 'providerForm') return '/auth-manager/providers/new';
  if (screen === 'userForm' && params.userId) {
    return `/auth-manager/users/${params.userId}`;
  }
  if (screen === 'userForm') return '/auth-manager/users/new';
  if (screen === 'deviceDetails' && params.deviceId) {
    return `/devices/${params.deviceId}`;
  }
  if (screen === 'keyDetails' && params.keyName) {
    return `/key-manager/keys/${params.keyName}`;
  }
  if (screen === 'keysList') {
    return '/key-manager/keys';
  }
  if (screen === 'createKey') {
    return '/key-manager/create';
  }
  if (screen === 'serviceSecretsList') {
    return '/key-manager/secrets';
  }
  if (screen === 'createServiceSecret') {
    return '/key-manager/secrets/create';
  }
  if (screen === 'serviceSecretDetails' && params.secretId) {
    return `/key-manager/secrets/${params.secretId}`;
  }
  if (screen === 'keyManager') {
    return '/key-manager';
  }
  if (screen === 'databaseManager') {
    return '/db-manager';
  }
  if (screen === 'databasesList') {
    return '/db-manager/databases';
  }
  if (screen === 'databaseDetails' && params.databaseName) {
    return `/db-manager/databases/${params.databaseName}`;
  }
  if (screen === 'createDatabase') {
    return '/db-manager/create';
  }
  if (screen === 'storageManager') {
    return '/storage-manager';
  }
  if (screen === 'projectsList') {
    return '/storage-manager/projects';
  }
  if (screen === 'bucketDetails' && params.bucketName) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}${projectId}`;
  }
  if (screen === 'bucketConfig' && params.bucketName) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}/config${projectId}`;
  }
  if (screen === 'fileDetails' && params.bucketName && params.key) {
    const projectId = params.projectId ? `?projectId=${params.projectId}` : '';
    return `/storage-manager/buckets/${params.bucketName}/files/${encodeURIComponent(params.key)}${projectId}`;
  }
  if (screen === 'bucketsList' && params.projectId) {
    return `/storage-manager/buckets?projectId=${params.projectId}`;
  }
  if (screen === 'bucketsList') {
    return '/storage-manager/buckets';
  }
  if (screen === 'projectForm') {
    if (params.mode === 'create') {
      return '/projects/new';
    }
    if (params.mode === 'edit' && params.projectId) {
      return `/projects/edit/${params.projectId}`;
    }
  }
  if (screen === 'projectDetails' && params.projectId) {
    return `/projects/${params.projectId}`;
  }
  return `/${screen}`;
}

module.exports = { getScreenFromPath, getPathFromScreen, BARE_SCREENS };

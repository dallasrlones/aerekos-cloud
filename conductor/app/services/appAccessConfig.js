/**
 * App-access metadata for console panels (scopes, pretty URL presets, list APIs).
 */
export const APP_ACCESS_MANAGERS = {
  ai_manager: {
    scopes: [
      { id: 'ai:InvokeLlm', label: 'LLM' },
      { id: 'ai:InvokeIntelligence', label: 'Intelligence' },
      { id: 'ai:InvokeEmbeddings', label: 'Embeddings' },
      { id: 'ai:InvokeTts', label: 'TTS' },
      { id: 'ai:InvokeStt', label: 'STT' },
      { id: 'ai:InvokeRag', label: 'RAG' },
      { id: 'ai:InvokeMemory', label: 'Memory' },
    ],
    defaultScopes: ['ai:InvokeLlm'],
    prettyPreset: (resource, projectId) => {
      const cap = resource.capability || 'llm';
      const name = resource.name;
      if (!projectId || !name) return null;
      if (cap === 'llm') return `/v1/projects/${projectId}/ai/llm/${name}/chat`;
      if (cap === 'embeddings') return `/v1/projects/${projectId}/ai/embeddings/${name}`;
      if (cap === 'tts') return `/v1/projects/${projectId}/ai/tts/${name}/synthesize`;
      if (cap === 'stt') return `/v1/projects/${projectId}/ai/stt/${name}/transcribe`;
      if (cap === 'intelligence') return `/v1/projects/${projectId}/ai/intelligence/${name}/chat`;
      return null;
    },
  },
  storage_manager: {
    scopes: [
      { id: 'storage:ListBucket', label: 'List' },
      { id: 'storage:PutObject', label: 'Upload' },
      { id: 'storage:GetObject', label: 'Download' },
      { id: 'storage:DeleteObject', label: 'Delete' },
    ],
    defaultScopes: ['storage:ListBucket'],
  },
  db_manager: {
    scopes: [
      { id: 'db:Connect', label: 'Connect' },
      { id: 'db:Admin', label: 'Admin' },
    ],
    defaultScopes: ['db:Connect'],
    prettyPreset: (resource, projectId) => (
      projectId && resource.name
        ? `/v1/projects/${projectId}/db/databases/${resource.name}/connection`
        : null
    ),
  },
  secrets_manager: {
    scopes: [
      { id: 'secrets:GetValue', label: 'Get value' },
      { id: 'secrets:List', label: 'List' },
    ],
    defaultScopes: ['secrets:GetValue'],
    prettyPreset: (resource, projectId) => (
      projectId && resource.id
        ? `/v1/projects/${projectId}/secrets/${resource.id}`
        : null
    ),
  },
  compute_manager: {
    scopes: [
      { id: 'compute:Describe', label: 'Describe' },
      { id: 'compute:Run', label: 'Run' },
      { id: 'compute:Stop', label: 'Stop' },
    ],
    defaultScopes: ['compute:Describe'],
    prettyPreset: (resource, projectId) => (
      projectId && resource.id
        ? `/v1/projects/${projectId}/compute/tasks/${resource.id}`
        : null
    ),
  },
  queue_manager: {
    scopes: [
      { id: 'queue:Send', label: 'Send' },
      { id: 'queue:Receive', label: 'Receive' },
    ],
    defaultScopes: ['queue:Send'],
    listPath: '/api/v1/queues',
    listKey: 'queues',
    resourceArn: (item, projectId) => item.arn || `arn:aerekos:${projectId}:queue:queue/${item.name}`,
    prettyPreset: (resource, projectId) => (
      projectId && resource.name
        ? `/v1/projects/${projectId}/queues/${resource.name}/messages`
        : null
    ),
  },
  webhook_manager: {
    scopes: [{ id: 'webhook:Dispatch', label: 'Dispatch' }],
    defaultScopes: ['webhook:Dispatch'],
    listPath: '/api/v1/webhooks',
    listKey: 'webhooks',
    resourceArn: (item, projectId) => item.arn || `arn:aerekos:${projectId}:webhook:endpoint/${item.name}`,
    prettyPreset: (resource, projectId) => (
      projectId && resource.id
        ? `/v1/projects/${projectId}/webhooks/${resource.id}/dispatch`
        : null
    ),
  },
  git_manager: {
    scopes: [
      { id: 'git:Read', label: 'Read' },
      { id: 'git:Push', label: 'Push' },
    ],
    defaultScopes: ['git:Read'],
    listPath: '/api/v1/repos',
    listKey: 'repositories',
    resourceArn: (item, projectId) => item.arn || `arn:aerekos:${projectId}:git:repository/${item.name}`,
    prettyPreset: (resource, projectId) => (
      projectId && resource.id
        ? `/v1/projects/${projectId}/git/repos/${resource.id}`
        : null
    ),
  },
};

export function getAppAccessConfig(serviceName) {
  return APP_ACCESS_MANAGERS[serviceName] || null;
}

export function buildPrettyUrl(apiBase, path) {
  if (!apiBase || !path) return null;
  const base = apiBase.replace(/\/$/, '');
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

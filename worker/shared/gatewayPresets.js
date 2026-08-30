'use strict';

/**
 * Standard API Gateway route presets — path templates map to manager proxy + ARN.
 * Seeded per project via api_manager POST /api/v1/endpoints/seed-presets.
 */
const GATEWAY_PRESETS = [
  {
    name: 'ai-llm-chat',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/ai/llm/{endpoint_name}/chat',
    target_service: 'ai_manager',
    target_path: '/api/v1/llm/chat',
    resource_arn_template: 'arn:aerekos:{project_id}:ai:llm:endpoint/{endpoint_name}',
    required_scope: 'ai:InvokeLlm',
  },
  {
    name: 'ai-embeddings',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/ai/embeddings/{endpoint_name}',
    target_service: 'ai_manager',
    target_path: '/api/v1/embeddings',
    resource_arn_template: 'arn:aerekos:{project_id}:ai:embeddings:endpoint/{endpoint_name}',
    required_scope: 'ai:InvokeEmbeddings',
  },
  {
    name: 'ai-tts-synthesize',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/ai/tts/{endpoint_name}/synthesize',
    target_service: 'ai_manager',
    target_path: '/api/v1/tts/synthesize',
    resource_arn_template: 'arn:aerekos:{project_id}:ai:tts:endpoint/{endpoint_name}',
    required_scope: 'ai:InvokeTts',
  },
  {
    name: 'ai-intelligence-chat',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/ai/intelligence/{endpoint_name}/chat',
    target_service: 'ai_manager',
    target_path: '/api/v1/intelligence/chat',
    resource_arn_template: 'arn:aerekos:{project_id}:ai:intelligence:endpoint/{endpoint_name}',
    required_scope: 'ai:InvokeIntelligence',
  },
  {
    name: 'ai-stt-transcribe',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/ai/stt/{endpoint_name}/transcribe',
    target_service: 'ai_manager',
    target_path: '/api/v1/stt/transcribe',
    resource_arn_template: 'arn:aerekos:{project_id}:ai:stt:endpoint/{endpoint_name}',
    required_scope: 'ai:InvokeStt',
  },
  {
    name: 'compute-describe-task',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/compute/tasks/{task_id}',
    target_service: 'compute_manager',
    target_path: '/api/v1/tasks/{task_id}',
    resource_arn_template: '',
    required_scope: 'compute:Describe',
    resolve_arn_at: 'target',
  },
  {
    name: 'db-connection',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/db/databases/{database_name}/connection',
    target_service: 'db_manager',
    target_path: '/api/databases/{database_name}/connection',
    resource_arn_template: 'arn:aerekos:{project_id}:db:database/{database_name}',
    required_scope: 'db:Connect',
  },
  {
    name: 'secrets-get-value',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/secrets/{secret_id}',
    target_service: 'secrets_manager',
    target_path: '/api/v1/secrets/{secret_id}',
    resource_arn_template: '',
    required_scope: 'secrets:GetValue',
    resolve_arn_at: 'target',
  },
  {
    name: 'queue-send',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/queues/{queue_name}/messages',
    target_service: 'queue_manager',
    target_path: '/api/v1/queues/{queue_name}/messages',
    resource_arn_template: 'arn:aerekos:{project_id}:queue:queue/{queue_name}',
    required_scope: 'queue:Send',
  },
  {
    name: 'webhook-dispatch',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/webhooks/{webhook_id}/dispatch',
    target_service: 'webhook_manager',
    target_path: '/api/v1/webhooks/{webhook_id}/dispatch',
    resource_arn_template: '',
    required_scope: 'webhook:Dispatch',
    resolve_arn_at: 'target',
  },
  {
    name: 'git-read-repo',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/git/repos/{repo_id}',
    target_service: 'git_manager',
    target_path: '/api/v1/repos/{repo_id}',
    resource_arn_template: '',
    required_scope: 'git:Read',
    resolve_arn_at: 'target',
  },
  {
    name: 'data-collection-list',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Read',
  },
  {
    name: 'data-collection-create',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Write',
  },
  {
    name: 'data-item-get',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}/{id}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}/{id}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Read',
  },
  {
    name: 'data-item-update',
    method: 'PATCH',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}/{id}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}/{id}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Write',
  },
  {
    name: 'data-item-delete',
    method: 'DELETE',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}/{id}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}/{id}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Write',
  },
  {
    name: 'data-nested-list',
    method: 'GET',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}/{id}/{child}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}/{id}/{child}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Read',
  },
  {
    name: 'data-nested-create',
    method: 'POST',
    public_path: '/v1/projects/{project_id}/data/{app}/{collection}/{id}/{child}',
    target_service: 'api_manager',
    target_path: '/api/v1/data/{app}/{collection}/{id}/{child}',
    resource_arn_template: 'arn:aerekos:{project_id}:data:{app}:{collection}',
    required_scope: 'data:Write',
  },
];

function listPresets() {
  return GATEWAY_PRESETS.map((p) => ({ ...p }));
}

function getPreset(name) {
  return GATEWAY_PRESETS.find((p) => p.name === name) || null;
}

module.exports = {
  GATEWAY_PRESETS,
  listPresets,
  getPreset,
};

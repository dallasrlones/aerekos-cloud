'use strict';

const arn = require('../../../shared/arn');

const SCOPE_BY_CAPABILITY = {
  llm: 'ai:InvokeLlm',
  embeddings: 'ai:InvokeEmbeddings',
  tts: 'ai:InvokeTts',
  stt: 'ai:InvokeStt',
  intelligence: 'ai:InvokeIntelligence',
  rag: 'ai:InvokeRag',
  memory: 'ai:InvokeMemory',
  agent: 'ai:InvokeAgent',
  connector: 'ai:InvokeConnector',
};

function resourceTypeForCapability(capability) {
  const cap = String(capability || 'llm').toLowerCase();
  if (cap === 'rag') return 'rag:collection';
  if (cap === 'memory') return 'memory:store';
  if (cap === 'connector') return 'connector:account';
  if (cap === 'agent') return 'agent:endpoint';
  return `${cap}:endpoint`;
}

function buildEndpointArn(projectId, capability, name) {
  return arn.build({
    projectId,
    namespace: 'ai',
    resourceType: resourceTypeForCapability(capability),
    name: String(name).trim(),
  });
}

function parseEndpointArn(raw) {
  const p = arn.parse(raw);
  if (!p || p.namespace !== 'ai') return null;
  const cap = p.resourceType
    .replace(/:endpoint$/, '')
    .replace(/:collection$/, '')
    .replace(/:store$/, '')
    .replace(/:account$/, '');
  if (!cap || cap === p.resourceType) return null;
  return { ...p, capability: cap };
}

function invokePathForCapability(capability) {
  const cap = String(capability || 'llm').toLowerCase();
  if (cap === 'llm') return '/api/v1/llm/chat';
  if (cap === 'embeddings') return '/api/v1/embeddings';
  if (cap === 'tts') return '/api/v1/tts/synthesize';
  if (cap === 'stt') return '/api/v1/stt/transcribe';
  if (cap === 'intelligence') return '/api/v1/intelligence/chat';
  if (cap === 'rag') return '/api/v1/rag/search';
  if (cap === 'memory') return '/api/v1/memory/search';
  if (cap === 'agent') return '/api/v1/agents';
  if (cap === 'connector') return '/api/v1/connectors/invoke';
  return `/api/v1/${cap}`;
}

const { aiPrettyInvokeUrl, proxyUrl } = require('../../../shared/invokeUrlHelpers');

function buildInvokeUrl(projectId, capability, name) {
  const pretty = aiPrettyInvokeUrl(projectId, capability, name);
  if (pretty) return pretty;
  const path = invokePathForCapability(capability);
  return proxyUrl('ai_manager', path);
}

function plainRow(row) {
  if (!row) return row;
  const json = typeof row.toJSON === 'function' ? row.toJSON() : { ...row };
  return {
    ...json,
    capability: row.capability || json.capability,
    project_id: row.project_id || json.project_id,
    name: row.name || json.name,
    arn: row.arn || json.arn,
  };
}

function enrichEndpoint(row) {
  if (!row) return row;
  const base = plainRow(row);
  const capability = base.capability || 'llm';
  const endpointArn = base.arn || buildEndpointArn(base.project_id, capability, base.name);
  return {
    ...base,
    arn: endpointArn,
    invoke_url: buildInvokeUrl(base.project_id, capability, base.name),
    invoke_scope: SCOPE_BY_CAPABILITY[capability] || null,
  };
}

module.exports = {
  buildEndpointArn,
  parseEndpointArn,
  buildInvokeUrl,
  enrichEndpoint,
  SCOPE_BY_CAPABILITY,
  resourceTypeForCapability,
};

'use strict';

const routeTemplate = require('./routeTemplate');
const { getPreset } = require('./gatewayPresets');

function publicBase(baseUrl) {
  return String(baseUrl || process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
}

function prettyUrlForPreset(presetName, params, baseUrl) {
  const preset = getPreset(presetName);
  if (!preset) return null;
  return routeTemplate.buildPublicUrl(publicBase(baseUrl), preset.public_path, params);
}

function proxyUrl(serviceName, targetPath, baseUrl) {
  const base = publicBase(baseUrl);
  if (!base) return null;
  const path = targetPath.startsWith('/') ? targetPath : `/${targetPath}`;
  return `${base}/api/services/${serviceName}${path}`;
}

function aiPrettyInvokeUrl(projectId, capability, endpointName, baseUrl) {
  const cap = String(capability || 'llm').toLowerCase();
  const params = { project_id: projectId, endpoint_name: endpointName };
  if (cap === 'llm') return prettyUrlForPreset('ai-llm-chat', params, baseUrl);
  if (cap === 'embeddings') return prettyUrlForPreset('ai-embeddings', params, baseUrl);
  if (cap === 'tts') return prettyUrlForPreset('ai-tts-synthesize', params, baseUrl);
  if (cap === 'stt') return prettyUrlForPreset('ai-stt-transcribe', params, baseUrl);
  if (cap === 'intelligence') return prettyUrlForPreset('ai-intelligence-chat', params, baseUrl);
  if (cap === 'agent') return prettyUrlForPreset('ai-agent-chat', params, baseUrl);
  if (cap === 'connector') return prettyUrlForPreset('ai-connector-invoke', params, baseUrl);
  return null;
}

module.exports = {
  publicBase,
  prettyUrlForPreset,
  proxyUrl,
  aiPrettyInvokeUrl,
};

'use strict';

/**
 * Placeable Cloud AI engines. Apps consume integrations; this catalog is what
 * you put on a GPU worker. vLLM / XTTS / Ollama do not surprise-start after OOM or an explicit stop.
 */

const NO_AUTO_START = new Set(['vllm', 'tts_xtts', 'ollama']);

const ENGINE_CATALOG = {
  vllm: {
    kind: 'vllm',
    label: 'vLLM',
    integration: 'orin-vllm',
    extra_integrations: [],
    capability: 'llm',
    container_name: 'aerekos-vllm',
    alt_names: [],
    host_port: 8000,
    auto_start: false,
    runtime: 'nvidia',
    image: process.env.VLLM_IMAGE || 'ghcr.io/nvidia-ai-iot/vllm:latest-jetson-orin',
  },
  ollama: {
    kind: 'ollama',
    label: 'Ollama',
    integration: 'orin-ollama',
    extra_integrations: ['orin-embeddings'],
    capability: 'llm',
    container_name: 'aerekos-ollama',
    alt_names: ['ollama'],
    host_port: 11434,
    auto_start: false,
    runtime: 'nvidia',
    image: process.env.OLLAMA_IMAGE || 'ollama/ollama:latest',
  },
  stt: {
    kind: 'stt',
    label: 'Whisper STT',
    integration: 'orin-stt',
    extra_integrations: [],
    capability: 'stt',
    container_name: 'aerekos-stt',
    alt_names: ['stt-service'],
    host_port: 8001,
    auto_start: true,
    runtime: 'nvidia',
    image: process.env.STT_IMAGE || 'openclaw/stt-service:latest',
  },
  tts_kokoro: {
    kind: 'tts_kokoro',
    label: 'Kokoro TTS',
    integration: 'orin-tts-kokoro',
    extra_integrations: [],
    capability: 'tts',
    container_name: 'aerekos-tts-kokoro',
    alt_names: ['tts-kokoro'],
    host_port: 8013,
    auto_start: true,
    runtime: 'nvidia',
    image: process.env.TTS_KOKORO_IMAGE || 'openclaw/tts-kokoro:latest',
  },
  tts_xtts: {
    kind: 'tts_xtts',
    label: 'XTTS',
    integration: 'orin-tts-xtts',
    extra_integrations: [],
    capability: 'tts',
    container_name: 'aerekos-tts-xtts',
    alt_names: ['tts-service'],
    host_port: 8002,
    auto_start: false,
    runtime: 'nvidia',
    image: process.env.TTS_XTTS_IMAGE || 'openclaw/tts-xtts:latest',
  },
  tts_cache: {
    kind: 'tts_cache',
    label: 'TTS cache',
    integration: 'orin-tts-cache',
    extra_integrations: [],
    capability: 'tts',
    container_name: 'aerekos-tts-cache',
    alt_names: ['tts-cache-api'],
    host_port: 8015,
    auto_start: true,
    runtime: '',
    image: process.env.TTS_CACHE_IMAGE || 'openclaw/tts-cache:latest',
  },
  icarus_workspace: {
    kind: 'icarus_workspace',
    label: 'Icarus workspace',
    integration: '',
    extra_integrations: [],
    capability: 'agent',
    container_name: 'aerekos-icarus-workspace',
    alt_names: ['icarus-workspace'],
    host_port: 0,
    auto_start: true,
    runtime: '',
    image: process.env.ICARUS_WORKSPACE_IMAGE || 'alpine:3.20',
  },
  icarus_browser: {
    kind: 'icarus_browser',
    label: 'Icarus browser',
    integration: '',
    extra_integrations: [],
    capability: 'browser',
    container_name: 'aerekos-icarus-browser',
    alt_names: ['icarus-browser'],
    host_port: 9222,
    auto_start: true,
    runtime: '',
    image: process.env.ICARUS_BROWSER_IMAGE || 'mcr.microsoft.com/playwright:v1.49.0-noble',
  },
  tts_cache_gen: {
    kind: 'tts_cache_gen',
    label: 'TTS cache generator',
    integration: '',
    extra_integrations: [],
    capability: 'tts',
    container_name: 'aerekos-tts-cache-gen',
    alt_names: ['tts-cache-gen'],
    host_port: 0,
    auto_start: true,
    runtime: '',
    image: process.env.TTS_CACHE_IMAGE || 'openclaw/tts-cache:latest',
  },
};

function catalogList() {
  return Object.values(ENGINE_CATALOG).map((c) => ({
    kind: c.kind,
    label: c.label,
    integration: c.integration,
    extra_integrations: c.extra_integrations,
    host_port: c.host_port,
    auto_start: c.auto_start,
    container_name: c.container_name,
    runtime: c.runtime || undefined,
  }));
}

function getKind(kind) {
  const row = ENGINE_CATALOG[String(kind || '').trim()];
  if (!row) {
    const e = new Error(`unknown engine kind: ${kind}`);
    e.status = 400;
    throw e;
  }
  return row;
}

function namesFor(kind) {
  const c = typeof kind === 'string' ? getKind(kind) : kind;
  return [c.container_name, ...(c.alt_names || [])].filter(Boolean);
}

function integrationNames(kind) {
  const c = typeof kind === 'string' ? getKind(kind) : kind;
  return [c.integration, ...(c.extra_integrations || [])].filter(Boolean);
}

function resolveEndpoint(kindOrRow, worker, aiManagerWorkerId) {
  const c = typeof kindOrRow === 'string' ? getKind(kindOrRow) : kindOrRow;
  const port = Number(c.host_port || 0);
  if (!port) return '';
  const wid = String(worker?.id || worker?.worker_id || '');
  const same = wid && aiManagerWorkerId && wid === String(aiManagerWorkerId);
  if (same) return `http://host.docker.internal:${port}`;
  const ip = String(worker?.ip_address || worker?.ip || '').trim();
  if (ip) return `http://${ip}:${port}`;
  return `http://host.docker.internal:${port}`;
}

function mayAutoStart(kind) {
  return !NO_AUTO_START.has(String(kind));
}

module.exports = {
  ENGINE_CATALOG,
  NO_AUTO_START,
  catalogList,
  getKind,
  namesFor,
  integrationNames,
  resolveEndpoint,
  mayAutoStart,
};

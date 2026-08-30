import api from '../utils/api';

const ROOT = '/api/services/ai_manager/api/v1';
const LLM = `${ROOT}/llm`;
const TTS = `${ROOT}/tts`;
const STT = `${ROOT}/stt`;
const EMB = `${ROOT}/embeddings`;

function routingPayload(body, { projectId, integration } = {}) {
  const payload = { ...body };
  if (integration) payload.integration = integration;
  if (projectId) payload.project_id = projectId;
  return payload;
}

function routingParams({ projectId, integration } = {}) {
  const params = {};
  if (projectId) params.project_id = projectId;
  if (integration) params.integration = integration;
  return params;
}

export const aiManagerService = {
  async info({ projectId } = {}) {
    const res = await api.get(`${ROOT}/info`, { params: routingParams({ projectId }) });
    return res.data;
  },

  // --- LLM -------------------------------------------------------------------
  async llmStatus({ projectId, integration } = {}) {
    const res = await api.get(`${LLM}/status`, { params: routingParams({ projectId, integration }) });
    return res.data;
  },
  async listModels({ projectId, integration, includeBenchmarks } = {}) {
    const params = routingParams({ projectId, integration });
    if (!params.project_id && projectId) params.project_id = projectId;
    if (includeBenchmarks) params.include_benchmarks = 'true';
    const res = await api.get(`${LLM}/models`, { params });
    return res.data?.models || [];
  },
  async listBenchmarks({ projectId, integration, suite } = {}) {
    const params = routingParams({ projectId, integration });
    if (suite) params.suite = suite;
    const res = await api.get(`${LLM}/benchmarks`, { params });
    return res.data;
  },
  async benchmarkStatus() {
    const res = await api.get(`${LLM}/benchmarks/status`);
    return res.data;
  },
  async listBenchmarkPending({ projectId, integration, suite } = {}) {
    const params = routingParams({ projectId, integration });
    if (suite) params.suite = suite;
    const res = await api.get(`${LLM}/benchmarks/pending`, { params });
    return res.data;
  },
  async runBenchmarks({ projectId, integration, force, models, suite } = {}) {
    const res = await api.post(
      `${LLM}/benchmarks/run`,
      routingPayload({ force: !!force, models, suite }, { projectId, integration }),
    );
    return res.data;
  },
  async pullModel(model, { projectId, integration } = {}) {
    const res = await api.post(`${LLM}/models/pull`, routingPayload({ model }, { projectId, integration }));
    return res.data;
  },
  async listPulls({ projectId } = {}) {
    const params = projectId ? { project_id: projectId } : {};
    const res = await api.get(`${LLM}/models/pulls`, { params });
    return res.data?.pulls || [];
  },
  async deleteModel(name, { projectId, integration } = {}) {
    const res = await api.delete(`${LLM}/models/${encodeURIComponent(name)}`, {
      params: routingParams({ projectId, integration }),
    });
    return res.data;
  },
  async chat(body, { projectId, integration } = {}) {
    const res = await api.post(`${LLM}/chat`, routingPayload(body, { projectId, integration }));
    return res.data;
  },
  async generate(body, { projectId, integration } = {}) {
    const res = await api.post(`${LLM}/generate`, routingPayload(body, { projectId, integration }));
    return res.data;
  },

  // --- TTS -------------------------------------------------------------------
  async ttsStatus({ projectId, integration } = {}) {
    const res = await api.get(`${TTS}/status`, { params: routingParams({ projectId, integration }) });
    return res.data;
  },
  async ttsCacheStats({ projectId, integration } = {}) {
    const res = await api.get(`${TTS}/cache/stats`, { params: routingParams({ projectId, integration }) });
    return res.data;
  },
  async synthesize(text, opts = {}) {
    const { projectId, integration, ...rest } = opts;
    const res = await api.post(
      `${TTS}/synthesize`,
      routingPayload({ text, ...rest }, { projectId, integration }),
      { responseType: 'blob' },
    );
    return URL.createObjectURL(res.data);
  },
  async listVoices({ projectId, integration } = {}) {
    const res = await api.get(`${TTS}/voices`, { params: routingParams({ projectId, integration }) });
    return res.data?.voices || res.data || [];
  },

  // --- STT -------------------------------------------------------------------
  async sttStatus({ projectId, integration } = {}) {
    const res = await api.get(`${STT}/status`, { params: routingParams({ projectId, integration }) });
    return res.data;
  },
  async transcribeFile(file, opts = {}) {
    const { projectId, integration, language, task } = opts;
    const form = new FormData();
    form.append('file', file);
    if (language) form.append('language', language);
    if (task) form.append('task', task);
    if (projectId) form.append('project_id', projectId);
    if (integration) form.append('integration', integration);
    const res = await api.post(`${STT}/transcribe`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    });
    return res.data;
  },

  // --- Embeddings ------------------------------------------------------------
  async embedStatus({ projectId } = {}) {
    const params = projectId ? { project_id: projectId } : {};
    const res = await api.get(`${EMB}/status`, { params });
    return res.data;
  },
  async embed(body, { projectId, integration } = {}) {
    const res = await api.post(`${EMB}/`, routingPayload(body, { projectId, integration }));
    return res.data;
  },

  async memoryStatus(projectId) {
    const res = await api.get(`${ROOT}/memory/status`, { params: { project_id: projectId } });
    return res.data;
  },

  // --- Endpoints (integrations) ----------------------------------------------
  /** Alias for listIntegrations — platform ARN-backed AI endpoints. */
  async listEndpoints(projectId, capability) {
    return this.listIntegrations(projectId, capability);
  },

  async listIntegrations(projectId, capability) {
    const params = { project_id: projectId };
    if (capability) params.capability = capability;
    const res = await api.get(`${ROOT}/providers`, { params });
    return res.data?.items || [];
  },

  async getIntegration(projectId, id) {
    const res = await api.get(`${ROOT}/providers/${id}`, { params: { project_id: projectId } });
    return res.data?.item;
  },

  async createIntegration(projectId, data) {
    const res = await api.post(`${ROOT}/providers`, { ...data, project_id: projectId });
    return res.data?.item;
  },

  async updateIntegration(projectId, id, data) {
    const res = await api.patch(`${ROOT}/providers/${id}`, { ...data, project_id: projectId });
    return res.data?.item;
  },

  async deleteIntegration(projectId, id) {
    await api.delete(`${ROOT}/providers/${id}`, { params: { project_id: projectId } });
  },

  async seedLocalIntegrations(projectId) {
    const res = await api.post(`${ROOT}/providers/seed-local`, { project_id: projectId });
    return res.data;
  },

  async testIntegration(projectId, id) {
    const res = await api.post(`${ROOT}/providers/${id}/test`, { project_id: projectId });
    return res.data;
  },

  async listIntelligence(projectId) {
    const res = await api.get(`${ROOT}/intelligence`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async getIntelligence(projectId, id) {
    const res = await api.get(`${ROOT}/intelligence/${id}`, { params: { project_id: projectId } });
    return res.data?.item;
  },
  async createIntelligence(projectId, data) {
    const res = await api.post(`${ROOT}/intelligence`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async updateIntelligence(projectId, id, data) {
    const res = await api.patch(`${ROOT}/intelligence/${id}`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async deleteIntelligence(projectId, id) {
    await api.delete(`${ROOT}/intelligence/${id}`, { params: { project_id: projectId } });
  },
  async attachIntelligence(projectId, id, data) {
    const res = await api.post(`${ROOT}/intelligence/${id}/attach`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async detachIntelligence(projectId, id, data) {
    const res = await api.post(`${ROOT}/intelligence/${id}/detach`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async intelligenceChat(projectId, data) {
    const res = await api.post(`${ROOT}/intelligence/chat`, { ...data, project_id: projectId });
    return res.data;
  },
  async attachBalancer(projectId, id, data = {}) {
    const res = await api.post(`${ROOT}/intelligence/${id}/attach-balancer`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async usage(projectId, query = {}) {
    const res = await api.get(`${ROOT}/intelligence/usage`, { params: { project_id: projectId, ...query } });
    return res.data;
  },

  async listRag(projectId) {
    const res = await api.get(`${ROOT}/rag`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async getRag(projectId, id) {
    const res = await api.get(`${ROOT}/rag/${id}`, { params: { project_id: projectId } });
    return res.data?.item;
  },
  async createRag(projectId, data) {
    const res = await api.post(`${ROOT}/rag`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async updateRag(projectId, id, data) {
    const res = await api.patch(`${ROOT}/rag/${id}`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async deleteRag(projectId, id) {
    await api.delete(`${ROOT}/rag/${id}`, { params: { project_id: projectId } });
  },
  async listRagDocuments(projectId, id) {
    const res = await api.get(`${ROOT}/rag/${id}/documents`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async ingestRagDocument(projectId, id, data) {
    const res = await api.post(`${ROOT}/rag/${id}/documents`, { ...data, project_id: projectId });
    return res.data;
  },
  async deleteRagDocument(projectId, id, docId) {
    await api.delete(`${ROOT}/rag/${id}/documents/${docId}`, { params: { project_id: projectId } });
  },
  async searchRag(projectId, id, query) {
    const res = await api.post(`${ROOT}/rag/${id}/search`, { project_id: projectId, query });
    return res.data;
  },

  async listMemoryStores(projectId) {
    const res = await api.get(`${ROOT}/memory/stores`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async createMemoryStore(projectId, data) {
    const res = await api.post(`${ROOT}/memory/stores`, { ...data, project_id: projectId });
    return res.data?.config;
  },
  async setupMemoryStore(projectId, data) {
    const res = await api.post(`${ROOT}/memory/setup`, { ...data, project_id: projectId });
    return res.data;
  },

  async listLora(projectId) {
    const res = await api.get(`${ROOT}/lora`, { params: { project_id: projectId } });
    return res.data?.adapters || [];
  },
  async trainLora(projectId, data) {
    const res = await api.post(`${ROOT}/lora/train`, { ...data, project_id: projectId });
    return res.data;
  },
  async attachLora(projectId, data) {
    const res = await api.post(`${ROOT}/lora/attach`, { ...data, project_id: projectId });
    return res.data;
  },

  /** @deprecated use llmStatus */
  async status() { return this.llmStatus(); },
};

export default aiManagerService;

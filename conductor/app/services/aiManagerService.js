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

  async applyVllm(projectId, id, data = {}) {
    const res = await api.post(`${ROOT}/providers/${id}/apply`, { ...data, project_id: projectId });
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
    const name = data?.intelligence || data?.name;
    let endpoint = null;
    if (name) {
      try {
        const items = await this.listIntelligence(projectId);
        endpoint = (items || []).find((x) => x.name === name);
      } catch (_) { /* fall through to sync */ }
    }
    if ((endpoint?.execution || data?.execution) === 'queued') {
      const job = await this.submitIntelligenceJob(projectId, data);
      return { queued: true, job: job.job || job };
    }
    const res = await api.post(
      `${ROOT}/intelligence/chat`,
      { ...data, project_id: projectId },
      { timeout: 120000 },
    );
    return res.data;
  },
  async submitIntelligenceJob(projectId, data) {
    const res = await api.post(`${ROOT}/intelligence/jobs`, { ...data, project_id: projectId });
    return res.data;
  },
  async listIntelligenceJobs(projectId, query = {}) {
    const res = await api.get(`${ROOT}/intelligence/jobs`, { params: { project_id: projectId, ...query } });
    return res.data?.items || [];
  },
  async getIntelligenceJob(projectId, id) {
    const res = await api.get(`${ROOT}/intelligence/jobs/${id}`, { params: { project_id: projectId } });
    return res.data?.job || res.data;
  },
  async cancelIntelligenceJob(projectId, id) {
    const res = await api.post(`${ROOT}/intelligence/jobs/${id}/cancel`, { project_id: projectId });
    return res.data?.job || res.data;
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
  async getMemoryStore(projectId, id) {
    const res = await api.get(`${ROOT}/memory/stores/${id}`, { params: { project_id: projectId } });
    return res.data?.item || res.data?.config;
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
  async getLora(projectId, id) {
    const res = await api.get(`${ROOT}/lora/${id}`, { params: { project_id: projectId } });
    return res.data;
  },
  async trainLora(projectId, data) {
    const res = await api.post(`${ROOT}/lora/train`, { ...data, project_id: projectId });
    return res.data;
  },
  async attachLora(projectId, data) {
    const res = await api.post(`${ROOT}/lora/attach`, { ...data, project_id: projectId });
    return res.data;
  },

  async listEngines({ projectId } = {}) {
    const res = await api.get(`${ROOT}/engines`, { params: routingParams({ projectId }) });
    return res.data;
  },
  async placeEngine(data, { projectId } = {}) {
    const res = await api.post(`${ROOT}/engines`, routingPayload(data, { projectId }));
    return res.data?.engine;
  },
  async startEngine(id, { projectId } = {}) {
    const res = await api.post(`${ROOT}/engines/${id}/start`, routingPayload({}, { projectId }));
    return res.data?.engine;
  },
  async stopEngine(id, { projectId } = {}) {
    const res = await api.post(`${ROOT}/engines/${id}/stop`, routingPayload({}, { projectId }));
    return res.data?.engine;
  },

  async agentSetupStatus(projectId) {
    const res = await api.get(`${ROOT}/agents/setup/status`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentSetup(projectId, data = {}) {
    const res = await api.post(`${ROOT}/agents/setup`, { ...data, project_id: projectId });
    return res.data;
  },
  async getAgentSettings(projectId) {
    const res = await api.get(`${ROOT}/agents/settings`, { params: { project_id: projectId } });
    return res.data?.item;
  },
  async updateAgentSettings(projectId, data) {
    const res = await api.patch(`${ROOT}/agents/settings`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async listAgents(projectId) {
    const res = await api.get(`${ROOT}/agents`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async getAgent(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}`, { params: { project_id: projectId } });
    return res.data?.item;
  },
  async createAgent(projectId, data) {
    const res = await api.post(`${ROOT}/agents`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async updateAgent(projectId, id, data) {
    const res = await api.patch(`${ROOT}/agents/${id}`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async deleteAgent(projectId, id) {
    await api.delete(`${ROOT}/agents/${id}`, { params: { project_id: projectId } });
  },
  async agentChat(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/chat`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentVoice(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/voice`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentInterrupt(projectId, id, data = {}) {
    const res = await api.post(`${ROOT}/agents/${id}/interrupt`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentApprove(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/approve`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentPulse(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/pulse`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentFleet(projectId) {
    const res = await api.get(`${ROOT}/agents/fleet`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentMessages(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/messages`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentPins(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/pins`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentPin(projectId, id, key, value) {
    const res = await api.post(`${ROOT}/agents/${id}/pins`, { project_id: projectId, key, value });
    return res.data?.item;
  },
  async agentForget(projectId, id, key) {
    const res = await api.delete(`${ROOT}/agents/${id}/pins/${encodeURIComponent(key)}`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentExportMemory(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/memory/export`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentWipeMemory(projectId, id) {
    const res = await api.post(`${ROOT}/agents/${id}/memory/wipe`, { project_id: projectId });
    return res.data;
  },
  async agentRolls(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/rolls`, { params: { project_id: projectId } });
    return res.data?.rolls || {};
  },
  async agentRefreshRolls(projectId, id) {
    const res = await api.post(`${ROOT}/agents/${id}/rolls/refresh`, { project_id: projectId });
    return res.data?.rolls || {};
  },
  async agentPlans(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/plans`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentPlan(projectId, id, planId) {
    const res = await api.get(`${ROOT}/agents/${id}/plans/${planId}`, { params: { project_id: projectId } });
    return res.data;
  },
  async agentConsoleEvents(projectId, id, events) {
    const res = await api.post(`${ROOT}/agents/${id}/console-events`, { project_id: projectId, events });
    return res.data;
  },
  async agentWork(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/work`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async patchAgentWork(projectId, id, workId, data) {
    const res = await api.patch(`${ROOT}/agents/${id}/work/${workId}`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async reorderAgentWork(projectId, id, ids) {
    const res = await api.post(`${ROOT}/agents/${id}/work/reorder`, { project_id: projectId, ids });
    return res.data?.items || [];
  },
  async getAgentPrompts(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/prompts`, { params: { project_id: projectId } });
    return res.data;
  },
  async patchAgentPrompts(projectId, id, prompts) {
    const res = await api.patch(`${ROOT}/agents/${id}/prompts`, { project_id: projectId, prompts });
    return res.data;
  },
  async resetAgentPrompts(projectId, id) {
    const res = await api.post(`${ROOT}/agents/${id}/prompts/reset`, { project_id: projectId });
    return res.data;
  },
  async agentAsks(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/asks`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentTimeline(projectId, id, since) {
    const res = await api.get(`${ROOT}/agents/${id}/timeline`, { params: { project_id: projectId, since } });
    return res.data?.items || [];
  },
  async agentWorkers(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/workers`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentSpawn(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/workers`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async agentCron(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/cron`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentCreateCron(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/cron`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async agentFireCron(projectId, id, cid) {
    const res = await api.post(`${ROOT}/agents/${id}/cron/${cid}/fire`, { project_id: projectId });
    return res.data;
  },
  async agentSkills(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/skills`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentCreateSkill(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/skills`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async agentAudit(projectId, id) {
    const res = await api.get(`${ROOT}/agents/${id}/audit`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async agentFs(projectId, id, rel = '.') {
    const res = await api.get(`${ROOT}/agents/${id}/fs`, { params: { project_id: projectId, path: rel } });
    return res.data;
  },
  async agentFsWrite(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/fs`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentTerm(projectId, id, cmd) {
    const res = await api.post(`${ROOT}/agents/${id}/term`, { project_id: projectId, cmd });
    return res.data;
  },
  async agentTool(projectId, id, data) {
    const res = await api.post(`${ROOT}/agents/${id}/tools`, { ...data, project_id: projectId });
    return res.data;
  },
  async agentResume(projectId) {
    const res = await api.post(`${ROOT}/agents/resume`, { project_id: projectId });
    return res.data;
  },
  async listConnectorKinds(projectId) {
    const res = await api.get(`${ROOT}/connectors/kinds`, { params: projectId ? { project_id: projectId } : {} });
    return res.data?.items || [];
  },
  async listConnectors(projectId) {
    const res = await api.get(`${ROOT}/connectors`, { params: { project_id: projectId } });
    return res.data?.items || [];
  },
  async createConnector(projectId, data) {
    const res = await api.post(`${ROOT}/connectors`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async updateConnector(projectId, id, data) {
    const res = await api.patch(`${ROOT}/connectors/${id}`, { ...data, project_id: projectId });
    return res.data?.item;
  },
  async deleteConnector(projectId, id) {
    await api.delete(`${ROOT}/connectors/${id}`, { params: { project_id: projectId } });
  },
  async invokeConnector(projectId, data) {
    const res = await api.post(`${ROOT}/connectors/invoke`, { ...data, project_id: projectId });
    return res.data?.result;
  },

  /** @deprecated use llmStatus */
  async status() { return this.llmStatus(); },
};

export default aiManagerService;

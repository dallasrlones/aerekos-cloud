const db = require('../utils/dbClient');

const AiModelConfig = db.model('AiModelConfig', {
  project_id: 'string',
  name: 'string',
  provider: 'string',
  provider_type: 'string',
  model: 'string',
  options: 'string',
  capability: 'string',
  endpoint: 'string',
  secret_ref: 'string',
  is_default: 'string',
  enabled: 'string',
  arn: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const MemoryStoreConfig = db.model('MemoryStoreConfig', {
  project_id: 'string',
  name: 'string',
  data_worker_id: 'string',
  embeddings_integration: 'string',
  extractor_integration: 'string',
  store_name_prefix: 'string',
  window_size: 'string',
  importance_threshold: 'string',
  ingest_rpm_per_session: 'string',
  ingest_rpm_per_user: 'string',
  status: 'string',
  options: 'string',
  store_arns: 'string',
  arn: 'string',
}, { required: ['project_id'], indexes: ['project_id', 'name'], timestamps: true });

/** Stable invoke URL for apps. LLM / RAG / memory bindings are hot-swappable. */
const IntelligenceEndpoint = db.model('IntelligenceEndpoint', {
  project_id: 'string',
  name: 'string',
  description: 'string',
  llm_integration: 'string',
  inject_memory: 'string',
  inject_rag: 'string',
  ingest_on_chat: 'string',
  is_default: 'string',
  enabled: 'string',
  options: 'string',
  arn: 'string',
  balancer_id: 'string',
  model: 'string',
  execution: 'string',
  queue_name: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const IntelligenceJob = db.model('IntelligenceJob', {
  project_id: 'string',
  intelligence: 'string',
  status: 'string',
  request: 'string',
  result: 'string',
  partial: 'string',
  error: 'string',
  idempotency_key: 'string',
}, { required: ['project_id', 'intelligence', 'status'], indexes: ['project_id', 'intelligence', 'status', 'idempotency_key'], timestamps: true });

const RagCollection = db.model('RagCollection', {
  project_id: 'string',
  name: 'string',
  description: 'string',
  embeddings_integration: 'string',
  enabled: 'string',
  options: 'string',
  arn: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const IntelligenceAttachment = db.model('IntelligenceAttachment', {
  project_id: 'string',
  intelligence_name: 'string',
  kind: 'string',
  target_name: 'string',
  priority: 'string',
  enabled: 'string',
}, { required: ['project_id', 'intelligence_name', 'kind', 'target_name'], indexes: ['project_id', 'intelligence_name'], timestamps: true });

const RagDocument = db.model('RagDocument', {
  project_id: 'string',
  collection_name: 'string',
  doc_id: 'string',
  title: 'string',
  text: 'string',
  vector: 'string',
  metadata: 'string',
}, { required: ['project_id', 'collection_name', 'doc_id'], indexes: ['project_id', 'collection_name'], timestamps: true });

/** Fleet inventory of AI engines (not a project app / Compute task). */
const AiEngine = db.model('AiEngine', {
  kind: 'string',
  worker_id: 'string',
  worker_hostname: 'string',
  status: 'string',
  container_name: 'string',
  container_id: 'string',
  host_port: 'string',
  endpoint: 'string',
  integration: 'string',
  options: 'string',
}, { required: ['kind', 'worker_id'], indexes: ['kind', 'worker_id'], timestamps: true });

const Agent = db.model('Agent', {
  project_id: 'string',
  name: 'string',
  type: 'string',
  mode: 'string',
  intelligence: 'string',
  memory: 'string',
  stt: 'string',
  tts: 'string',
  voice: 'string',
  timezone: 'string',
  display_name: 'string',
  language: 'string',
  state_db: 'string',
  storage_bucket: 'string',
  rag_collection: 'string',
  user_id: 'string',
  enabled: 'string',
  status: 'string',
  arn: 'string',
  roll_refresh_sec: 'string',
  notify_on_ask: 'string',
  notify_on_done: 'string',
  options: 'string',
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

const AgentSettings = db.model('AgentSettings', {
  project_id: 'string',
  llm_max_concurrent: 'string',
  lane_min_interval_ms: 'string',
  workspace_worker_id: 'string',
  workspace_root: 'string',
  write_policy: 'string',
  write_exceptions: 'string',
  notify_on_ask: 'string',
  notify_on_done: 'string',
  browser_url: 'string',
  options: 'string',
}, { required: ['project_id'], indexes: ['project_id'], timestamps: true });

const AgentWorkItem = db.model('AgentWorkItem', {
  project_id: 'string',
  agent_id: 'string',
  kind: 'string',
  parent_id: 'string',
  title: 'string',
  status: 'string',
  priority: 'string',
  dod: 'string',
  assigned_worker_id: 'string',
  relationships: 'string',
  payload: 'string',
}, { required: ['project_id', 'agent_id', 'kind', 'title'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentAsk = db.model('AgentAsk', {
  project_id: 'string',
  agent_id: 'string',
  text: 'string',
  options_json: 'string',
  recommended: 'string',
  status: 'string',
  answer: 'string',
  kind: 'string',
  payload: 'string',
  from_layer: 'string',
  speak_text: 'string',
}, { required: ['project_id', 'agent_id', 'text'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentWorker = db.model('AgentWorker', {
  project_id: 'string',
  agent_id: 'string',
  work_item_id: 'string',
  persona: 'string',
  status: 'string',
  objective: 'string',
  transcript: 'string',
  claim_prefix: 'string',
  parent_worker_id: 'string',
  compressed: 'string',
  messages_json: 'string',
  retry_count: 'string',
  replan_count: 'string',
  chunk_grant: 'string',
}, { required: ['project_id', 'agent_id'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentBrief = db.model('AgentBrief', {
  project_id: 'string',
  agent_id: 'string',
  goal: 'string',
  done_when: 'string',
  constraints_json: 'string',
  unknowns_json: 'string',
  client_words: 'string',
  status: 'string',
}, { required: ['project_id', 'agent_id', 'goal'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentTimeline = db.model('AgentTimeline', {
  project_id: 'string',
  agent_id: 'string',
  at: 'string',
  layer: 'string',
  type: 'string',
  ref_id: 'string',
  summary: 'string',
}, { required: ['project_id', 'agent_id', 'type'], indexes: ['project_id', 'agent_id'], timestamps: true });

const AgentMessage = db.model('AgentMessage', {
  project_id: 'string',
  agent_id: 'string',
  role: 'string',
  content: 'string',
  layer: 'string',
  job_id: 'string',
  ask_id: 'string',
}, { required: ['project_id', 'agent_id', 'role'], indexes: ['project_id', 'agent_id'], timestamps: true });

const AgentPin = db.model('AgentPin', {
  project_id: 'string',
  agent_id: 'string',
  key: 'string',
  value: 'string',
}, { required: ['project_id', 'agent_id', 'key'], indexes: ['project_id', 'agent_id'], timestamps: true });

const AgentRoll = db.model('AgentRoll', {
  project_id: 'string',
  agent_id: 'string',
  horizon: 'string',
  body: 'string',
  refreshed_at: 'string',
}, { required: ['project_id', 'agent_id', 'horizon'], indexes: ['project_id', 'agent_id', 'horizon'], timestamps: true });

const AgentCron = db.model('AgentCron', {
  project_id: 'string',
  agent_id: 'string',
  name: 'string',
  schedule: 'string',
  handoff: 'string',
  enabled: 'string',
  last_fired_at: 'string',
  kind: 'string',
  run_at: 'string',
  timezone: 'string',
  last_error: 'string',
}, { required: ['project_id', 'agent_id', 'name'], indexes: ['project_id', 'agent_id'], timestamps: true });

const AgentKnowledgeSource = db.model('AgentKnowledgeSource', {
  project_id: 'string',
  agent_id: 'string',
  url: 'string',
  kind: 'string',
  etag: 'string',
  sha: 'string',
  fetched_at: 'string',
  ttl_days: 'string',
  collection_id: 'string',
  status: 'string',
}, { required: ['project_id', 'agent_id', 'url'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentLearnJob = db.model('AgentLearnJob', {
  project_id: 'string',
  agent_id: 'string',
  work_item_id: 'string',
  status: 'string',
  checkpoint: 'string',
  claim: 'string',
}, { required: ['project_id', 'agent_id'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentLearnPage = db.model('AgentLearnPage', {
  project_id: 'string',
  job_id: 'string',
  url: 'string',
  title: 'string',
  kind: 'string',
  status: 'string',
  local_path: 'string',
  error: 'string',
  text: 'string',
}, { required: ['project_id', 'job_id', 'url'], indexes: ['project_id', 'job_id', 'status'], timestamps: true });

const AgentPlan = db.model('AgentPlan', {
  project_id: 'string',
  agent_id: 'string',
  origin: 'string',
  origin_kind: 'string',
  status: 'string',
  revision: 'string',
  steps_json: 'string',
  question: 'string',
  constraints_json: 'string',
}, { required: ['project_id', 'agent_id'], indexes: ['project_id', 'agent_id', 'status'], timestamps: true });

const AgentSkill = db.model('AgentSkill', {
  project_id: 'string',
  agent_id: 'string',
  name: 'string',
  template: 'string',
}, { required: ['project_id', 'agent_id', 'name'], indexes: ['project_id', 'agent_id'], timestamps: true });

const AgentAudit = db.model('AgentAudit', {
  project_id: 'string',
  agent_id: 'string',
  actor: 'string',
  kind: 'string',
  tool: 'string',
  meta: 'string',
}, { required: ['project_id', 'kind'], indexes: ['project_id', 'agent_id'], timestamps: true });

const Connector = db.model('Connector', {
  project_id: 'string',
  name: 'string',
  kind: 'string',
  auth: 'string',
  secret_ref: 'string',
  status: 'string',
  scopes: 'string',
  arn: 'string',
  options: 'string',
}, { required: ['project_id', 'name', 'kind'], indexes: ['project_id', 'name', 'kind'], timestamps: true });

const IntelligenceUsage = db.model('IntelligenceUsage', {
  project_id: 'string',
  endpoint_name: 'string',
  user_id: 'string',
  session_id: 'string',
  model: 'string',
  prompt_tokens: 'number',
  completion_tokens: 'number',
  total_tokens: 'number',
  latency_ms: 'number',
}, { required: ['project_id', 'endpoint_name'], indexes: ['project_id', 'user_id', 'endpoint_name'], timestamps: true });

module.exports = {
  AiModelConfig,
  AiEngine,
  MemoryStoreConfig,
  IntelligenceEndpoint,
  RagCollection,
  IntelligenceAttachment,
  RagDocument,
  IntelligenceUsage,
  IntelligenceJob,
  Agent,
  AgentSettings,
  AgentWorkItem,
  AgentAsk,
  AgentBrief,
  AgentTimeline,
  AgentWorker,
  AgentMessage,
  AgentPin,
  AgentRoll,
  AgentCron,
  AgentKnowledgeSource,
  AgentLearnJob,
  AgentLearnPage,
  AgentPlan,
  AgentSkill,
  AgentAudit,
  Connector,
  db,
};

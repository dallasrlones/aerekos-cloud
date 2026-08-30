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
}, { required: ['project_id', 'name'], indexes: ['project_id', 'name'], timestamps: true });

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
  MemoryStoreConfig,
  IntelligenceEndpoint,
  RagCollection,
  IntelligenceAttachment,
  RagDocument,
  IntelligenceUsage,
  db,
};

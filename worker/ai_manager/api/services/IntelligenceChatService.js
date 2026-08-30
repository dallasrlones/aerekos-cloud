'use strict';

const { randomUUID } = require('crypto');
const { IntelligenceService } = require('./IntelligenceService');
const { UsageService, estimateTokens } = require('./UsageService');
const { RagCollectionService } = require('./RagCollectionService');
const { MemoryRetrieveService } = require('./MemoryRetrieveService');
const { MemoryIngestService } = require('./MemoryIngestService');
const { parseEndpointArn } = require('./EndpointArn');
const { resolveLlmByIntegration } = require('./llmResolve');

function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role === 'user' && list[i]?.content) return String(list[i].content);
  }
  return '';
}

function pickChatModel(models) {
  const list = Array.isArray(models) ? models : [];
  const chat = list.filter((m) => {
    const name = String(m?.name || m?.model || '');
    const family = String(m?.details?.family || '');
    if (!name) return false;
    if (family.includes('bert') || /embed/i.test(name)) return false;
    return true;
  });
  const byName = (re) => chat.find((m) => re.test(m.name || m.model || ''));
  const hit = byName(/llama3\.2:3b/i) || byName(/:1b\b|:3b\b|:8b\b/i);
  if (hit) return hit.name || hit.model;
  const sorted = [...chat].sort((a, b) => (a.size || Infinity) - (b.size || Infinity));
  return sorted[0]?.name || sorted[0]?.model;
}

class IntelligenceChatService {
  constructor(deps = {}) {
    this.intel = deps.intel || new IntelligenceService();
    this.rag = deps.rag || new RagCollectionService();
    this.retrieve = deps.retrieve || new MemoryRetrieveService();
    this.ingest = deps.ingest || new MemoryIngestService();
    this.usage = deps.usage || new UsageService();
  }

  async resolveEndpoint(projectId, req) {
    const resource = req.body?.resource || req.headers?.['x-aerekos-resource'];
    const parsed = resource ? parseEndpointArn(resource) : null;
    if (parsed?.capability === 'intelligence') {
      return this.intel.getByName(parsed.projectId || projectId, parsed.name);
    }
    const name = req.body?.intelligence || req.params?.name || req.query?.intelligence;
    if (name) return this.intel.getByName(projectId, name);
    const byId = req.body?.intelligence_id || req.params?.id;
    if (byId) return this.intel.get(byId, projectId);
    const def = await this.intel.getDefault(projectId);
    if (!def) {
      const e = new Error('no intelligence endpoint — create one or pass intelligence name / resource ARN');
      e.status = 404;
      throw e;
    }
    return def;
  }

  async gatherContext(projectId, endpoint, queryText, body) {
    const parts = [];
    const used = { rag: [], memory: [] };

    if (endpoint.inject_rag && queryText) {
      for (const att of endpoint.rag || []) {
        try {
          const hit = await this.rag.search(projectId, att.name, { query: queryText, top_k: 4 });
          const lines = (hit.items || []).filter((i) => i.score > 0.05).map((i) => i.text);
          if (lines.length) {
            parts.push(`## Knowledge (${att.name})\n${lines.map((l) => `- ${l}`).join('\n')}`);
            used.rag.push(att.name);
          }
        } catch {
          /* degrade */
        }
      }
    }

    if (endpoint.inject_memory && body.user_id) {
      for (const att of endpoint.memory || []) {
        try {
          const mem = await this.retrieve.retrieve(projectId, {
            store_name: att.name,
            user_id: body.user_id,
            session_id: body.session_id,
            query_text: queryText,
            short_term: true,
            long_term: true,
            top_k: 6,
          });
          if (mem.context) {
            parts.push(mem.context.replace('## Conversation memory', `## Memory (${att.name})`));
            used.memory.push(att.name);
          }
        } catch {
          /* degrade */
        }
      }
    }

    return { appendix: mergeContext(parts), used };
  }

  async chat(projectId, req) {
    const endpoint = await this.resolveEndpoint(projectId, req);
    if (endpoint.enabled === false || endpoint.enabled === 'false') {
      const e = new Error('intelligence endpoint is disabled');
      e.status = 409;
      throw e;
    }
    if (!endpoint.llm_integration) {
      const e = new Error('bind an LLM endpoint before chatting — PATCH llm_integration');
      e.status = 409;
      e.code = 'llm_not_bound';
      throw e;
    }

    const body = req.body || {};
    const messages = Array.isArray(body.messages) ? [...body.messages] : [];
    if (!messages.length) {
      const e = new Error('messages[] is required');
      e.status = 400;
      throw e;
    }

    const queryText = lastUserText(messages);
    const { appendix, used } = await this.gatherContext(projectId, endpoint, queryText, body);
    if (appendix) {
      messages.unshift({ role: 'system', content: appendix });
    }

    const svc = await resolveLlmByIntegration(projectId, endpoint.llm_integration);
    await svc.ensureRunning();
    let model = body.model;
    if (!model) {
      try {
        const llm = await this.intel.providers.getByName(projectId, endpoint.llm_integration, 'llm');
        model = llm.model || undefined;
      } catch { /* caller must pass model for Ollama */ }
    }
    if (!model && typeof svc.listModels === 'function') {
      try {
        const models = await svc.listModels();
        model = pickChatModel(models);
      } catch { /* */ }
    }
    const loraAtt = (endpoint.lora || [])[0];
    if (loraAtt && model) {
      model = loraAtt.derived_model || `${model}-${loraAtt.name}`;
    }
    if (!model) {
      const e = new Error('model is required (set it on the bound LLM endpoint or pass model in the body)');
      e.status = 400;
      throw e;
    }
    const started = Date.now();
    const result = await svc.chat({ ...body, model, messages });
    const tokens = estimateTokens(messages, result);
    try {
      await this.usage.record({
        project_id: projectId,
        endpoint_name: endpoint.name,
        user_id: body.user_id || '',
        session_id: body.session_id || '',
        model,
        ...tokens,
        latency_ms: Date.now() - started,
      });
    } catch {
      /* usage must not fail chat */
    }

    if (endpoint.ingest_on_chat && body.user_id && body.session_id) {
      const reply = result?.message?.content || result?.response || '';
      for (const att of endpoint.memory || []) {
        try {
          await this.ingest.ingest(projectId, {
            store_name: att.name,
            user_id: body.user_id,
            session_id: body.session_id,
            message_id: body.message_id || randomUUID(),
            role: 'user',
            content: queryText,
            seq: messages.length,
          });
          if (reply) {
            await this.ingest.ingest(projectId, {
              store_name: att.name,
              user_id: body.user_id,
              session_id: body.session_id,
              message_id: randomUUID(),
              role: 'assistant',
              content: reply,
              seq: messages.length + 1,
            });
          }
        } catch {
          /* memory not ready is ok */
        }
      }
    }

    return {
      ...result,
      intelligence: endpoint.name,
      arn: endpoint.arn,
      llm_integration: endpoint.llm_integration,
      used,
    };
  }
}

module.exports = { IntelligenceChatService };

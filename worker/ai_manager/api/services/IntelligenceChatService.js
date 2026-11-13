'use strict';

const { randomUUID } = require('crypto');
const { IntelligenceService } = require('./IntelligenceService');
const { UsageService, estimateTokens } = require('./UsageService');
const { RagCollectionService } = require('./RagCollectionService');
const { MemoryRetrieveService } = require('./MemoryRetrieveService');
const { MemoryIngestService } = require('./MemoryIngestService');
const { parseEndpointArn } = require('./EndpointArn');
const { resolveLlmByIntegration } = require('./llmResolve');
const { resolveOwnedChatModel } = require('./ownedChatModel');
const { mergeContext } = require('../utils/mergeContext');

function lastUserText(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i]?.role === 'user' && list[i]?.content) return String(list[i].content);
  }
  return '';
}

class IntelligenceChatService {
  constructor(deps = {}) {
    this.intel = deps.intel || new IntelligenceService();
    this.rag = deps.rag || new RagCollectionService();
    this.retrieve = deps.retrieve || new MemoryRetrieveService();
    this.ingest = deps.ingest || new MemoryIngestService();
    this.usage = deps.usage || new UsageService();
    this.resolveLlm = deps.resolveLlm || resolveLlmByIntegration;
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
    const { laneInject } = require('./layerContext');
    const policy = laneInject(body?.lane);
    const wantRag = policy.rag == null ? !!endpoint.inject_rag : policy.rag;
    const wantMemory = policy.memory == null ? !!endpoint.inject_memory : policy.memory;

    if (wantRag && queryText) {
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

    if (wantMemory && body.user_id) {
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

    const svc = await this.resolveLlm(projectId, endpoint.llm_integration);
    await svc.ensureRunning();
    let llm = null;
    try {
      llm = await this.intel.providers.getByName(projectId, endpoint.llm_integration, 'llm');
    } catch { /* bound name may still resolve via env */ }
    let listedModels = [];
    if (typeof svc.listModels === 'function') {
      try { listedModels = await svc.listModels(); } catch { /* */ }
    }
    // Personality LoRA: Laya finetune_pick (or body.selected_lora) — never tools/code on vLLM.
    let selectedLora = body.selected_lora || null;
    if (!selectedLora && Array.isArray(endpoint.lora) && endpoint.lora.length) {
      try {
        const { layaDecision } = require('./LayaDecisionService');
        const pick = await layaDecision.predict(
          {
            text: queryText,
            adapters: endpoint.lora.map((a) => a.name || a.id).filter(Boolean),
            wantPersonality: body.lane === 'user' || body.lane === 'talk' || !body.lane,
          },
          { finetune_pick: {} },
        );
        const choice = pick.answers?.finetune_pick?.choice;
        if (choice && choice !== 'none') {
          selectedLora = endpoint.lora.find((a) => /personality/i.test(a.name || '') || a.kind === 'personality')
            || endpoint.lora.find((a) => a.attached || a.selected)
            || endpoint.lora[0];
        } else {
          selectedLora = null; // explicit none — stay on base
        }
      } catch {
        selectedLora = undefined; // fall through to resolveOwnedChatModel default
      }
    }
    const { model } = resolveOwnedChatModel({
      endpoint, provider: llm, listedModels, selectedLora,
    });
    if (!model) {
      const e = new Error('model is required (set it on the intelligence endpoint)');
      e.status = 400;
      throw e;
    }
    const { model: _clientModel, messages: _clientMessages, ...chatBody } = body;
    const started = Date.now();
    const onDelta = req.onDelta;
    const abortSignal = req.abortSignal;
    let result;
    const useStream = onDelta && typeof svc.streamChat === 'function' && !body.tools;
    if (useStream) {
      result = await svc.streamChat({ ...chatBody, model, messages }, { onDelta, abortSignal });
    } else {
      result = await svc.chat({ ...chatBody, model, messages });
      const text = result?.message?.content || result?.response || '';
      if (onDelta && text) onDelta(text);
    }
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

    const ingestLane = require('./layerContext').laneInject(body.lane);
    const wantIngest = ingestLane.memory == null ? true : ingestLane.memory;
    if (endpoint.ingest_on_chat && wantIngest && body.user_id && body.session_id) {
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
      model,
      used,
    };
  }
}

module.exports = { IntelligenceChatService, mergeContext };

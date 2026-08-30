const { ProviderResolver } = require('./ProviderResolver');
const { OllamaService } = require('./OllamaService');

const EXTRACT_SCHEMA = `Return ONLY valid JSON:
{
  "items": [{ "type": "fact|preference|decision|commitment|entity", "text": "...", "importance": 0.0-1.0 }],
  "narrative": "2-4 sentence summary preserving specifics"
}`;

class MemoryExtractService {
  constructor(deps = {}) {
    this.resolver = deps.resolver || new ProviderResolver();
  }

  async extract(projectId, config, { role, content }) {
    const text = String(content || '').trim();
    if (!text) return { items: [], narrative: '', importance: 0.2 };

    if (!config?.extractor_integration) {
      return this._heuristic(text, role);
    }

    try {
      const fakeReq = {
        query: { project_id: projectId, integration: config.extractor_integration },
        body: {},
      };
      const cfg = await this.resolver.resolve(fakeReq, 'llm');
      const env = { ...process.env, OLLAMA_HOST: cfg.endpoint, OLLAMA_MODE: 'external' };
      const svc = new OllamaService(env);
      const model = cfg.model || process.env.LLM_MODEL || 'llama3.2:3b';
      const prompt = `Extract durable memory from this ${role} message.\n${EXTRACT_SCHEMA}\n\nMessage:\n${text.slice(0, 4000)}`;
      const raw = await svc.generate({ model, prompt, stream: false });
      const response = raw?.response || raw?.message?.content || '';
      const parsed = this._parseJson(response);
      if (parsed) {
        const topImportance = Math.max(
          0.2,
          ...(parsed.items || []).map((i) => Number(i.importance) || 0),
        );
        return { ...parsed, importance: topImportance };
      }
    } catch (err) {
      console.warn('[MemoryExtractService] LLM extract failed:', err.message);
    }
    return this._heuristic(text, role);
  }

  _parseJson(raw) {
    const match = String(raw).match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }

  _heuristic(text, role) {
    let importance = 0.45;
    if (text.length < 20) importance = 0.2;
    else if (/\b(remember|prefer|always|never|goal|commit|deadline)\b/i.test(text)) importance = 0.85;
    else if (role === 'user' && text.length > 120) importance = 0.7;
    return {
      items: importance >= 0.6 ? [{ type: 'fact', text, importance }] : [],
      narrative: text.slice(0, 280),
      importance,
    };
  }
}

module.exports = { MemoryExtractService };

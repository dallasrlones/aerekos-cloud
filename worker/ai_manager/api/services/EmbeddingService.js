const { OllamaService } = require('./OllamaService');

/**
 * Embeddings via Ollama /api/embed. Model is configurable per-request or via env.
 */
class EmbeddingService {
  constructor(env = process.env) {
    this.ollama = new OllamaService(env);
    this.defaultModel = env.EMBEDDING_MODEL || env.OLLAMA_EMBED_MODEL || 'mxbai-embed-large';
  }

  async status() {
    const base = await this.ollama.status();
    return { ...base, default_model: this.defaultModel };
  }

  /**
   * @param {{ model?, input, options? }} body — input: string or string[]
   */
  async embed(body) {
    const model = body.model || this.defaultModel;
    const input = body.input;
    if (input == null || (Array.isArray(input) && input.length === 0) || (typeof input === 'string' && !input.trim())) {
      const e = new Error('input is required (string or string[])'); e.status = 400; throw e;
    }
    await this.ollama.ensureRunning();
    return this.ollama.embed({ model, input, options: body.options });
  }
}

module.exports = { EmbeddingService };

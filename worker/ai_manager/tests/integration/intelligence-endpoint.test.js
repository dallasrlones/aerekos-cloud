const request = require('supertest');
const app = require('../../index.js');

const PID = 'd57d380d-acfe-49b0-b5a9-ba973892bc8b';

describe('intelligence endpoints', () => {
  const suffix = Date.now();
  let llmA;
  let llmB;
  let ragId;
  let intelId;

  afterAll(async () => {
    if (intelId) await request(app).delete(`/api/v1/intelligence/${intelId}`).query({ project_id: PID });
    if (ragId) await request(app).delete(`/api/v1/rag/${ragId}`).query({ project_id: PID });
    if (llmA) await request(app).delete(`/api/v1/providers/${llmA}`).query({ project_id: PID });
    if (llmB) await request(app).delete(`/api/v1/providers/${llmB}`).query({ project_id: PID });
  });

  test('create LLM, RAG, intelligence, attach, hot-swap LLM', async () => {
    const a = await request(app).post('/api/v1/providers').send({
      project_id: PID,
      name: `intel-llm-a-${suffix}`,
      capability: 'llm',
      provider: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      model: 'llama3.2:3b',
    });
    expect(a.status).toBe(201);
    llmA = a.body.item.id;

    const b = await request(app).post('/api/v1/providers').send({
      project_id: PID,
      name: `intel-llm-b-${suffix}`,
      capability: 'llm',
      provider: 'vllm',
      endpoint: 'http://127.0.0.1:8000',
      model: 'cyankiwi/Qwen3.6-35B-A3B-AWQ-4bit',
    });
    expect(b.status).toBe(201);
    llmB = b.body.item.id;

    const rag = await request(app).post('/api/v1/rag').send({
      project_id: PID,
      name: `kb-handbook-${suffix}`.slice(0, 40),
      embeddings_integration: '',
    });
    expect(rag.status).toBe(201);
    ragId = rag.body.item.id;
    expect(rag.body.item.arn).toContain(':ai:rag:collection/');

    const docs = await request(app).post(`/api/v1/rag/${ragId}/documents`).send({
      project_id: PID,
      title: 'oncall',
      text: 'Aerekos Cloud intelligence endpoints bind a swappable LLM plus RAG collections.',
    });
    expect(docs.status).toBe(201);
    expect(docs.body.ingested).toBeGreaterThan(0);

    const search = await request(app).post(`/api/v1/rag/${ragId}/search`).send({
      project_id: PID,
      query: 'swappable LLM',
    });
    expect(search.status).toBe(200);
    expect(search.body.items.length).toBeGreaterThan(0);

    const intel = await request(app).post('/api/v1/intelligence').send({
      project_id: PID,
      name: `icarus-${suffix}`.slice(0, 40),
      llm_integration: a.body.item.name,
      rag: [rag.body.item.name],
    });
    expect(intel.status).toBe(201);
    intelId = intel.body.item.id;
    expect(intel.body.item.arn).toBe(`arn:aerekos:${PID}:ai:intelligence:endpoint/${intel.body.item.name}`);
    expect(intel.body.item.llm_integration).toBe(a.body.item.name);
    expect(intel.body.item.rag.map((x) => x.name)).toContain(rag.body.item.name);

    const swapped = await request(app).patch(`/api/v1/intelligence/${intelId}`).send({
      project_id: PID,
      llm_integration: b.body.item.name,
    });
    expect(swapped.status).toBe(200);
    expect(swapped.body.item.arn).toBe(intel.body.item.arn);
    expect(swapped.body.item.llm_integration).toBe(b.body.item.name);

    const detached = await request(app).post(`/api/v1/intelligence/${intelId}/detach`).send({
      project_id: PID,
      kind: 'rag',
      target_name: rag.body.item.name,
    });
    expect(detached.status).toBe(200);
    expect(detached.body.item.rag).toHaveLength(0);

    const attached = await request(app).post(`/api/v1/intelligence/${intelId}/attach`).send({
      project_id: PID,
      kind: 'rag',
      target_name: rag.body.item.name,
    });
    expect(attached.status).toBe(200);
    expect(attached.body.item.rag).toHaveLength(1);

    const modeled = await request(app).patch(`/api/v1/intelligence/${intelId}`).send({
      project_id: PID,
      model: 'shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP',
    });
    expect(modeled.status).toBe(200);
    expect(modeled.body.item.model).toBe('shawnw3i/Huihui-Qwen3.8-27B-abliterated-AWQ-MTP');
    expect(modeled.body.item.arn).toBe(intel.body.item.arn);
  });

  test('queued endpoint rejects sync chat with 409', async () => {
    const llm = await request(app).post('/api/v1/providers').send({
      project_id: PID,
      name: `queued-llm-${suffix}`,
      capability: 'llm',
      provider: 'ollama',
      endpoint: 'http://127.0.0.1:11434',
      model: 'llama3.2:3b',
    });
    const intel = await request(app).post('/api/v1/intelligence').send({
      project_id: PID,
      name: `queued-bot-${suffix}`,
      llm_integration: llm.body.item.name,
      execution: 'sync',
    });
    const patched = await request(app).patch(`/api/v1/intelligence/${intel.body.item.id}`).send({
      project_id: PID,
      execution: 'queued',
    });
    expect(patched.status).toBe(200);
    expect(patched.body.item.execution).toBe('queued');
    const chat = await request(app).post('/api/v1/intelligence/chat').send({
      project_id: PID,
      intelligence: intel.body.item.name,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(chat.status).toBe(409);
    expect(chat.body.error.code).toBe('queued_endpoint');
    await request(app).delete(`/api/v1/intelligence/${intel.body.item.id}`).query({ project_id: PID });
    await request(app).delete(`/api/v1/providers/${llm.body.item.id}`).query({ project_id: PID });
  });
});

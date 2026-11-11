'use strict';

/**
 * LoRA catalog + GPU train jobs. Ticket T40.
 * POST /train queues a PEFT job on the lora_trainer GPU sidecar.
 */
const fs = require('fs');
const path = require('path');
const { requireAuth } = require('../../../shared/authManagerClient');
const r = require('express').Router();
r.use(requireAuth());

const CATALOG = (() => {
  const env = process.env.AI_MANAGER_DATA_DIR;
  if (env && env.endsWith('.json')) return env;
  const root = env || path.join(__dirname, '..', '..', 'data');
  return path.join(root, 'lora-adapters.json');
})();
const ROOT = path.dirname(CATALOG);
const JOBS = path.join(ROOT, 'lora-jobs');

function load() {
  try {
    return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
  } catch {
    return { adapters: [] };
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(CATALOG), { recursive: true });
  fs.writeFileSync(CATALOG, JSON.stringify(state, null, 2));
}

function jobStatus(id) {
  const dir = path.join(JOBS, id);
  if (fs.existsSync(path.join(dir, 'done.json'))) {
    try {
      return { status: 'completed', ...JSON.parse(fs.readFileSync(path.join(dir, 'done.json'), 'utf8')) };
    } catch {
      return { status: 'completed' };
    }
  }
  if (fs.existsSync(path.join(dir, 'failed.json'))) {
    try {
      return { status: 'failed', ...JSON.parse(fs.readFileSync(path.join(dir, 'failed.json'), 'utf8')) };
    } catch {
      return { status: 'failed' };
    }
  }
  if (fs.existsSync(path.join(dir, 'running.json'))) return { status: 'running' };
  if (fs.existsSync(path.join(dir, 'queued.json'))) return { status: 'queued' };
  return null;
}

function reconcile(state) {
  let dirty = false;
  for (const a of state.adapters) {
    const js = jobStatus(a.id);
    if (!js) continue;
    if (a.status !== js.status) {
      a.status = js.status;
      dirty = true;
    }
    if (js.out && a.weights !== js.out) {
      a.weights = js.out;
      a.cuda = !!js.cuda;
      a.loss = js.loss;
      dirty = true;
    }
    if (js.error && a.error !== js.error) {
      a.error = js.error;
      dirty = true;
    }
  }
  if (dirty) save(state);
  return state;
}

function queueJob(adapter, examples) {
  const dir = path.join(JOBS, adapter.id);
  fs.mkdirSync(dir, { recursive: true });
  const lines = (Array.isArray(examples) ? examples : []).map((row) => JSON.stringify(row));
  fs.writeFileSync(path.join(dir, 'examples.jsonl'), lines.join('\n') + (lines.length ? '\n' : ''));
  fs.writeFileSync(
    path.join(dir, 'queued.json'),
    JSON.stringify(
      {
        id: adapter.id,
        name: adapter.name,
        project_id: adapter.project_id,
        base: process.env.LORA_BASE_MODEL || 'sshleifer/tiny-gpt2',
        steps: Number(process.env.LORA_MAX_STEPS || 8),
      },
      null,
      2,
    ),
  );
}

r.post('/train', async (req, res) => {
  const pid = req.query.project_id || req.body?.project_id;
  if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
  try {
    const { chatRunning, ensureInbox, publish } = require('../services/AiRabbit');
    if (await chatRunning(pid)) {
      return res.status(409).json({ error: { message: 'a chat job is running — wait before LoRA train' } });
    }
    if (process.env.SKIP_LORA !== '1') {
      await ensureInbox(pid, 'lora-inbox');
    }
  } catch (e) {
    if (e.status === 409) return res.status(409).json({ error: { message: e.message } });
    /* continue — disk queue still works */
  }
  const name = String(req.body?.name || `adapter-${Date.now()}`).trim();
  const examples = Array.isArray(req.body?.examples) ? req.body.examples : [];
  const agentKind = String(req.body?.agent_kind || req.body?.kind || 'coding');
  const base = String(req.body?.base_llm || req.body?.base_model || process.env.LORA_BASE_MODEL || 'qwen');
  const state = load();
  const adapter = {
    id: `lora-${Date.now().toString(36)}`,
    project_id: pid,
    name,
    attached: false,
    examples: examples.length,
    status: process.env.SKIP_LORA === '1' ? 'completed' : 'queued',
    base,
    agent_kind: agentKind,
    train_host: 'orin',
    created_at: new Date().toISOString(),
  };
  if (process.env.SKIP_LORA !== '1') queueJob(adapter, examples);
  adapter.derived_model = `${adapter.base}-${adapter.name}`;
  // Control-plane: Orin trains; Qwen pins local, Gemma* plans move to minis
  try {
    const { loraTrain } = require('../services/LoraTrainService');
    const job = loraTrain.enqueue({
      projectId: pid,
      agentKind,
      adapterName: name,
      baseModel: base,
      epochs: req.body?.epochs,
      dataset: examples.map((e) => JSON.stringify(e)).join('\n'),
      targets: req.body?.targets,
    });
    adapter.icarus_job_id = job.id;
    if (process.env.SKIP_LORA === '1') {
      loraTrain.update(job.id, {
        status: 'succeeded',
        adapter_path: `/models/lora/${name}`,
        adapter_version: adapter.id,
      });
      adapter.distribute = loraTrain.get(job.id)?.distribute || null;
    }
  } catch (_) { /* optional facade */ }
  state.adapters.push(adapter);
  save(state);
  if (process.env.SKIP_LORA !== '1') {
    try {
      const { publish } = require('../services/AiRabbit');
      await publish(pid, 'lora-inbox', {
        job_id: adapter.id, train_host: 'orin', base_model: base, agent_kind: agentKind,
      });
    } catch (_) { /* disk queued.json remains */ }
  }
  res.status(201).json({
    adapter, job_id: adapter.id, status: adapter.status, train_host: 'orin',
  });
});

r.get('/train-targets', (_req, res) => {
  try {
    const { loraTrain } = require('../services/LoraTrainService');
    return res.json(loraTrain.targets());
  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
});

r.post('/attach', (req, res) => {
  const pid = req.query.project_id || req.body?.project_id;
  const id = req.body?.adapter_id || req.body?.id;
  const intelligence = req.body?.intelligence || req.body?.intelligence_name;
  if (!pid || !id) return res.status(400).json({ error: { message: 'project_id and adapter_id are required' } });
  const state = reconcile(load());
  const adapter = state.adapters.find((a) => a.id === id && a.project_id === pid);
  if (!adapter) return res.status(404).json({ error: { message: 'adapter not found' } });
  adapter.attached_intelligence = intelligence || adapter.attached_intelligence || '';
  adapter.derived_model = adapter.derived_model || `${adapter.base || 'base'}-${adapter.name}`;
  if (process.env.SKIP_LORA === '1') adapter.derived_model = `${adapter.base || 'tiny-gpt2'}-${adapter.name}`;
  save(state);
  res.json({ attached: true, adapter, intelligence: adapter.attached_intelligence, derived_model: adapter.derived_model });
});

r.get('/:id', (req, res) => {
  const state = reconcile(load());
  const adapter = state.adapters.find((a) => a.id === req.params.id);
  if (!adapter) return res.status(404).json({ error: { message: 'adapter not found' } });
  res.json({ adapter, job: jobStatus(adapter.id) });
});

r.get('/', (req, res) => {
  const pid = req.query.project_id;
  if (!pid) return res.status(400).json({ error: { message: 'project_id is required' } });
  const state = reconcile(load());
  res.json({ adapters: state.adapters.filter((a) => a.project_id === pid) });
});

module.exports = r;

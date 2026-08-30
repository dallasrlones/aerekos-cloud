'use strict';

const { randomUUID } = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');
const { Fn, Invocation, EventSource } = require('../models');
const { CrudService, fail } = require('../../../shared/crudBase');
const { conductorBase, authHeaders, proxy, skipFlag } = require('../../../shared/conductorProxy');

const SKIP_INVOKE = skipFlag('SKIP_INVOKE');
const SKIP_POLLER = skipFlag('SKIP_POLLER');

function headers(projectId) {
  return authHeaders(projectId);
}

function parseEnv(raw) {
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try { return JSON.parse(raw); } catch { return {}; }
}

function runNodeHandler(source, handlerSpec, payload, env, timeoutMs) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aerekos-fn-'));
  fs.writeFileSync(path.join(dir, 'index.js'), source);
  const handlerName = String(handlerSpec || 'index.handler').split('.').pop();
  const runner = `
    const mod = require(${JSON.stringify(path.join(dir, 'index.js'))});
    const fn = mod[${JSON.stringify(handlerName)}] || mod.handler || (typeof mod === 'function' ? mod : null);
    if (!fn) { console.error('no handler'); process.exit(2); }
    const event = JSON.parse(process.env.AEREKOS_EVENT || '{}');
    Promise.resolve(fn(event, { functionName: process.env.AEREKOS_FUNCTION }))
      .then((out) => { process.stdout.write(JSON.stringify(out === undefined ? null : out)); })
      .catch((err) => { console.error(err && err.stack || err); process.exit(1); });
  `;
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['-e', runner], {
      env: { ...process.env, ...env, AEREKOS_EVENT: JSON.stringify(payload || {}) },
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
    }, timeoutMs);
    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) { /* tmp */ }
      if (code !== 0) {
        const err = new Error(stderr.trim() || `handler exited ${code}`);
        err.log = (stdout + stderr).slice(0, 2000);
        return reject(err);
      }
      try {
        resolve({ result: stdout ? JSON.parse(stdout) : null, log: (stdout + stderr).slice(0, 2000) });
      } catch {
        resolve({ result: stdout, log: (stdout + stderr).slice(0, 2000) });
      }
    });
  });
}

async function loadCode(fn) {
  if (!fn.code_bucket || !fn.code_key) return '';
  try {
    const res = await proxy('GET', `/api/services/storage_manager/api/projects/${encodeURIComponent(fn.project_id)}/buckets/${encodeURIComponent(fn.code_bucket)}/files/${fn.code_key}`, {
      projectId: fn.project_id,
      timeout: 20000,
      responseType: 'text',
    });
    if (res.status >= 400) return '';
    return typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
  } catch {
    return '';
  }
}

class FunctionService extends CrudService {
  constructor() { super(Fn); }

  async create(body) {
    const name = String(body.name || '').trim();
    const trigger = body.trigger === undefined ? { queue: true } : body.trigger;
    const inbox = trigger === false || trigger?.queue === false
      ? ''
      : (typeof trigger?.queue === 'string' ? trigger.queue : `${name}-inbox`);
    const dlq = inbox ? `${name}-dlq` : '';
    const saved = await super.create({
      ...body,
      name,
      runtime: body.runtime || 'node20',
      handler: body.handler || 'index.handler',
      timeout_ms: String(body.timeout_ms || 30000),
      memory_mb: String(body.memory_mb || 256),
      env: typeof body.env === 'string' ? body.env : JSON.stringify(body.env || {}),
      inbox_queue: inbox,
      dlq,
    });
    if (inbox && process.env.SKIP_QUEUE_PROVISION !== '1') {
      try {
        await axios.post(`${conductorBase()}/api/services/queue_manager/api/v1/queues`, {
          project_id: body.project_id,
          name: inbox,
          engine: 'standard',
          dlq,
          visibility_timeout_seconds: Math.ceil(Number(saved.timeout_ms || 30000) / 1000) + 10,
        }, { headers: headers(body.project_id), timeout: 10000, validateStatus: () => true });
        if (dlq) {
          await axios.post(`${conductorBase()}/api/services/queue_manager/api/v1/queues`, {
            project_id: body.project_id,
            name: dlq,
            engine: 'standard',
          }, { headers: headers(body.project_id), timeout: 10000, validateStatus: () => true });
        }
      } catch (_) { /* queue_manager may be down in unit tests */ }
    }
    if (inbox) {
      await EventSource.create({
        project_id: body.project_id,
        function_id: saved.id,
        kind: 'queue',
        ref: inbox,
        batch_size: '1',
        enabled: 'true',
      });
    }
    return saved;
  }

  async ensureDefaults(projectId) {
    const items = await this.list(projectId);
    let hello = items.find((i) => i.name === 'hello');
    if (!hello) {
      hello = await this.create({
        project_id: projectId,
        name: 'hello',
        runtime: 'node20',
        handler: 'index.handler',
        trigger: { queue: true },
      });
    }
    return { function: hello };
  }

  async getByName(projectId, name) {
    const rows = await Fn.findAll({ where: { project_id: projectId, name } });
    if (!rows.length) throw fail(404, `function not found: ${name}`);
    return rows[0];
  }

  async invoke(projectId, name, { payload, invocation_type } = {}) {
    const fn = await this.getByName(projectId, name);
    const requestId = randomUUID();
    const type = invocation_type || 'RequestResponse';
    if (type === 'Event') {
      if (fn.inbox_queue) {
        try {
          await axios.post(
            `${conductorBase()}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(fn.inbox_queue)}/messages`,
            { project_id: projectId, body: { request_id: requestId, payload: payload || {} } },
            { headers: headers(projectId), timeout: 10000, validateStatus: () => true },
          );
        } catch (_) { /* recorded anyway */ }
      }
      await Invocation.create({
        project_id: projectId,
        function_id: fn.id,
        status: 'queued',
        duration_ms: '0',
        request_id: requestId,
        log_tail: '',
        error: '',
      });
      return { status: 202, request_id: requestId, invocation_type: 'Event' };
    }
    const started = Date.now();
    let result;
    let error = '';
    let status = 'succeeded';
    let logTail = '';
    if (SKIP_INVOKE) {
      result = { echo: payload || {}, request_id: requestId, function: fn.name };
    } else {
      try {
        const timeoutMs = Math.max(1000, Number(fn.timeout_ms || 30000));
        const env = parseEnv(fn.env);
        env.AEREKOS_FUNCTION = fn.name;
        if (fn.image && !skipFlag('SKIP_DOCKER')) {
          const taskName = `fn-${fn.name}-${Date.now().toString(36)}`.slice(0, 64);
          const res = await proxy('POST', '/api/services/compute_manager/api/v1/tasks', {
            projectId,
            timeout: timeoutMs + 15000,
            data: {
              project_id: projectId,
              name: taskName,
              image: fn.image,
              run_mode: 'oneshot',
              env: { ...env, AEREKOS_EVENT: JSON.stringify(payload || {}) },
            },
          });
          if (res.status >= 400) throw new Error(res.data?.error?.message || `compute_manager ${res.status}`);
          result = { task: res.data?.task || res.data, request_id: requestId };
          logTail = JSON.stringify(result).slice(0, 2000);
        } else {
          const source = (await loadCode(fn)) || `'use strict';
exports.handler = async (event) => ({ ok: true, function: ${JSON.stringify(fn.name)}, payload: event });
`;
          const ran = await runNodeHandler(source, fn.handler, payload, env, timeoutMs);
          result = ran.result;
          logTail = ran.log;
        }
      } catch (err) {
        status = 'failed';
        error = err.message;
        result = { error: err.message };
        logTail = err.log || err.message;
      }
    }
    await Invocation.create({
      project_id: projectId,
      function_id: fn.id,
      status,
      duration_ms: String(Date.now() - started),
      request_id: requestId,
      log_tail: logTail || JSON.stringify(result).slice(0, 2000),
      error,
    });
    return { status: 200, request_id: requestId, result, invocation_type: 'RequestResponse' };
  }

  async pollOnce(projectId) {
    if (SKIP_POLLER) return { skipped: true };
    const mappings = await EventSource.findAll({ where: { project_id: projectId, kind: 'queue', enabled: 'true' } });
    const out = [];
    for (const m of mappings) {
      try {
        const rec = await axios.post(
          `${conductorBase()}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(m.ref)}/messages/receive`,
          { project_id: projectId, max_number_of_messages: Number(m.batch_size || 1) },
          { headers: headers(projectId), timeout: 10000, validateStatus: () => true },
        );
        const msgs = rec.data?.Messages || [];
        for (const msg of msgs) {
          const fnRows = await Fn.findAll({ where: { id: m.function_id } });
          const fn = fnRows[0];
          if (!fn) continue;
          let body = {};
          try { body = JSON.parse(msg.Body); } catch { body = { raw: msg.Body }; }
          await this.invoke(projectId, fn.name, { payload: body.payload || body, invocation_type: 'RequestResponse' });
          await axios.delete(
            `${conductorBase()}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(m.ref)}/messages/${encodeURIComponent(msg.MessageId)}`,
            { headers: headers(projectId), params: { project_id: projectId }, timeout: 10000, validateStatus: () => true },
          );
          out.push(msg.MessageId);
        }
      } catch (_) { /* ignore */ }
    }
    return { acked: out };
  }
}

module.exports = { FunctionService };

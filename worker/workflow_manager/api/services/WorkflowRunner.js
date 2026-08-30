'use strict';

const { proxy, skipFlag } = require('../../../shared/conductorProxy');

const OUTBOUND_DISABLED = { skipped: true, reason: 'outbound_disabled' };

function sleep(ms) {
  const cap = Math.min(Math.max(0, Number(ms) || 0), 5000);
  return new Promise((r) => setTimeout(r, cap));
}

function parseDef(raw) {
  if (!raw) return { steps: [] };
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return { steps: [] }; }
}

function getPath(obj, path) {
  if (!path) return obj;
  const p = String(path).replace(/^\$\.?/, '');
  return p.split('.').filter(Boolean).reduce((acc, k) => (acc == null ? acc : acc[k]), obj);
}

function evalChoice(choice, input) {
  const val = getPath(input, choice.Variable || choice.variable);
  if (choice.BooleanEquals !== undefined) return val === choice.BooleanEquals;
  if (choice.StringEquals !== undefined) return String(val) === String(choice.StringEquals);
  if (choice.NumericEquals !== undefined) return Number(val) === Number(choice.NumericEquals);
  if (choice.eq !== undefined) return val === choice.eq;
  if (choice.present) return getPath(input, choice.present) != null;
  if (choice.when) return Boolean(getPath(input, choice.when));
  return Boolean(val);
}

class WorkflowRunner {
  constructor(service) {
    this.service = service;
  }

  async runStep(step, input, projectId) {
    const type = String(step.Type || step.type || step.Resource || step.resource || 'pass').toLowerCase();
    if (type === 'email' || type === 'sms' || type === 'slack' || type === 'push') {
      try {
        const outbound = require('../../../shared/outboundSend');
        const fn = type === 'email' ? outbound.sendEmail
          : type === 'sms' ? outbound.sendSms
          : type === 'push' ? outbound.sendPush
          : outbound.sendSlack;
        const result = await fn({
          to: step.to || input.to,
          subject: step.subject || input.subject,
          body: step.body || input.body || step.text,
          text: step.text || input.text,
          channel: step.channel || input.channel,
          title: step.title || input.title,
        });
        if (!result.sent) return { ...OUTBOUND_DISABLED, type, reason: result.reason };
        return { type, ok: true, sent: true };
      } catch (e) {
        return { ...OUTBOUND_DISABLED, type, error: e.message };
      }
    }
    if (type === 'wait') {
      await sleep((step.Seconds || step.seconds || 0) * 1000 || step.ms || 0);
      return { type: 'wait', ok: true };
    }
    if (type === 'pass' || type === 'succeed') {
      return { type, ok: true, output: step.Result || step.result || input };
    }
    if (type === 'fail') {
      const e = new Error(step.Error || step.error || 'workflow failed');
      e.status = 400;
      throw e;
    }
    if (type === 'choice') {
      return { type: 'choice', ok: true };
    }
    if (type === 'http' || (type === 'task' && String(step.Resource || step.resource || '').toLowerCase() === 'http')) {
      if (skipFlag('SKIP_OUTBOUND')) return { type: 'http', ...OUTBOUND_DISABLED };
      const url = step.url || step.Parameters?.url || step.parameters?.url;
      if (!url) return { type: 'http', error: 'url required' };
      const payload = step.body || step.Parameters?.body || input;
      if (url.startsWith('/')) {
        const res = await proxy(step.method || 'POST', url, { projectId, data: payload })
          .catch((err) => ({ status: 502, data: { error: err.message } }));
        return { type: 'http', status: res.status, data: res.data };
      }
      const axios = require('axios');
      const r = await axios({
        method: step.method || 'POST',
        url,
        data: payload,
        validateStatus: () => true,
        timeout: 15000,
      });
      return { type: 'http', status: r.status, data: r.data };
    }
    if (type === 'queue') {
      const queue = step.queue || step.Parameters?.queue || step.parameters?.queue;
      const res = await proxy('POST', `/api/services/queue_manager/api/v1/queues/${encodeURIComponent(queue || 'default')}/messages`, {
        projectId,
        data: { project_id: projectId, body: step.body || input },
      }).catch((err) => ({ status: 502, data: { error: err.message } }));
      return { type: 'queue', status: res.status, data: res.data };
    }
    if (type === 'function') {
      const name = step.name || step.function || step.Parameters?.name || 'default';
      const res = await proxy('POST', `/api/services/function_manager/api/v1/functions/${encodeURIComponent(name)}/invoke`, {
        projectId,
        data: { project_id: projectId, payload: step.payload || input },
      }).catch((err) => ({ status: 502, data: { error: err.message } }));
      return { type: 'function', status: res.status, data: res.data };
    }
    return { type, ok: true, output: input };
  }

  async runDefinition(def, input, projectId) {
    const results = [];
    if (Array.isArray(def.steps)) {
      let ctx = input;
      for (const step of def.steps) {
        const type = String(step.type || step.Type || '').toLowerCase();
        if (type === 'choice') {
          const ok = evalChoice(step, ctx);
          results.push({ type: 'choice', matched: ok });
          continue;
        }
        const out = await this.runStep(step, ctx, projectId);
        results.push(out);
        if (out.output) ctx = out.output;
      }
      return results;
    }
    if (def.States && def.StartAt) {
      let name = def.StartAt;
      let ctx = input;
      const seen = new Set();
      while (name && def.States[name] && !seen.has(name)) {
        seen.add(name);
        const state = def.States[name];
        const type = String(state.Type || '').toLowerCase();
        if (type === 'choice') {
          let next = state.Default || state.default;
          for (const c of state.Choices || state.choices || []) {
            if (evalChoice(c, ctx)) { next = c.Next || c.next; break; }
          }
          results.push({ type: 'choice', next });
          name = next;
          continue;
        }
        if (type === 'succeed' || type === 'fail') {
          results.push(await this.runStep(state, ctx, projectId));
          break;
        }
        const out = await this.runStep(state, ctx, projectId);
        results.push(out);
        if (out.output) ctx = out.output;
        name = state.Next || state.next || null;
      }
      return results;
    }
    return results;
  }

  async run(id, projectId, input = {}) {
    const item = await this.service.get(id, projectId);
    const def = parseDef(item.definition);
    await this.service.update(id, projectId, { status: 'running' });
    try {
      const steps = await this.runDefinition(def, input, projectId);
      const last_run = JSON.stringify({ at: new Date().toISOString(), steps });
      const updated = await this.service.update(id, projectId, { status: 'succeeded', last_run });
      return { item: updated, steps, status: 'succeeded' };
    } catch (err) {
      const last_run = JSON.stringify({ at: new Date().toISOString(), error: err.message });
      await this.service.update(id, projectId, { status: 'failed', last_run }).catch(() => {});
      throw err;
    }
  }
}

module.exports = { WorkflowRunner, OUTBOUND_DISABLED };

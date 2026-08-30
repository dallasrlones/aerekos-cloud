'use strict';

const { ProjectStack, PlatformJob } = require('../models');
const { requireShared } = require('../utils/loadWorkerShared');
const {
  emptyStack,
  mergeRecords,
  removeRecords,
  listClickOps,
  getClickOps,
  collectionPath,
  sanitizeResource,
} = requireShared('clickOpsCatalog');

function parse(json, fallback) {
  if (!json) return fallback;
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function skipFlag(name) {
  const v = process.env[name];
  return v === '1' || v === 'true';
}

function conductorBase() {
  const port = process.env.PORT || 3000;
  return process.env.CONDUCTOR_INTERNAL_BASE_URL?.replace(/\/$/, '') || `http://127.0.0.1:${port}`;
}

function authHeaders(projectId) {
  const tok = process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN || '';
  return {
    ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
    'x-project-id': projectId,
    'Content-Type': 'application/json',
  };
}

class StackService {
  empty(projectId) {
    return emptyStack(projectId);
  }

  async current(projectId) {
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    const latest = rows[0] || null;
    const fallback = emptyStack(projectId);
    return {
      stack: latest ? { ...fallback, ...parse(latest.content, fallback) } : fallback,
      applied: latest ? parse(latest.applied, null) : null,
      revision: latest ? Number(latest.revision || 0) : 0,
      status: latest ? latest.status : 'empty',
    };
  }

  async put(projectId, body) {
    const cur = await this.current(projectId);
    if (cur.status === 'applying') {
      const e = new Error('apply in progress');
      e.status = 409;
      throw e;
    }
    const content = { ...emptyStack(projectId), ...body, kind: 'project-stack', project_id: projectId };
    const revision = cur.revision + 1;
    await ProjectStack.create({
      project_id: projectId,
      revision,
      content: JSON.stringify(content),
      applied: cur.applied ? JSON.stringify(cur.applied) : '',
      status: 'draft',
      lock_holder: '',
    });
    await this.upsertIacModule(projectId, content);
    return this.current(projectId);
  }

  async record(projectId, body) {
    const entries = Array.isArray(body?.items) && body.items.length
      ? body.items
      : [{ service: body?.service, key: body?.key, resource: body?.resource }];
    const cur = await this.current(projectId);
    const next = mergeRecords(cur.stack, entries);
    return this.put(projectId, next);
  }

  async unrecord(projectId, body) {
    const entries = Array.isArray(body?.items) && body.items.length
      ? body.items
      : [{ service: body?.service, key: body?.key, name: body?.name }];
    const cur = await this.current(projectId);
    const next = removeRecords(cur.stack, entries);
    return this.put(projectId, next);
  }

  async recordWanted(projectId, serviceName) {
    if (!projectId || !serviceName) return null;
    try {
      const cur = await this.current(projectId);
      const wanted = new Set(cur.stack.wanted || []);
      wanted.add(serviceName);
      return this.put(projectId, { ...cur.stack, wanted: [...wanted] });
    } catch {
      return null;
    }
  }

  diffObjects(a, b) {
    return {
      from: a || {},
      to: b || {},
      changed: JSON.stringify(a || {}) !== JSON.stringify(b || {}),
    };
  }

  async diff(projectId) {
    const cur = await this.current(projectId);
    return this.diffObjects(cur.applied || {}, cur.stack);
  }

  async apply(projectId) {
    const cur = await this.current(projectId);
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    const latest = rows[0];
    if (!latest) {
      const e = new Error('no stack to apply');
      e.status = 404;
      throw e;
    }
    if (latest.lock_holder) {
      const e = new Error('stack is locked');
      e.status = 409;
      throw e;
    }
    await ProjectStack.update(latest.id, {
      status: 'applied',
      applied: latest.content,
      lock_holder: '',
    });
    const content = parse(latest.content, emptyStack(projectId));
    const provisioned = await this.provision(projectId, content);
    const job = await PlatformJob.create({
      project_id: projectId,
      kind: 'stack-apply',
      status: 'succeeded',
      summary: `applied revision ${latest.revision}`,
      detail: JSON.stringify(provisioned),
    });
    return { ...(await this.current(projectId)), job, provisioned };
  }

  async provision(projectId, stack) {
    const skip = skipFlag('SKIP_STACK_PROVISION');
    const out = { skipped: skip, results: {} };
    if (skip) {
      for (const ops of listClickOps()) {
        out.results[ops.stackKey] = stack[ops.stackKey] || [];
      }
      return out;
    }
    const axios = require('axios');
    const base = conductorBase();
    const headers = authHeaders(projectId);
    for (const ops of listClickOps()) {
      if (!ops.provision) continue;
      const items = Array.isArray(stack[ops.stackKey]) ? stack[ops.stackKey] : [];
      const rows = [];
      const path = collectionPath(ops, projectId);
      const url = `${base}/api/services/${ops.name}${path}`;
      for (const item of items) {
        const body = sanitizeResource(ops, {
          project_id: projectId,
          ...ops.defaults,
          ...item,
        });
        try {
          const res = await axios.post(url, body, {
            headers,
            timeout: 20000,
            validateStatus: () => true,
          });
          rows.push({ name: item.name, status: res.status, ok: res.status < 400 || res.status === 409 });
        } catch (e) {
          rows.push({ name: item.name, error: e.message, ok: false });
        }
      }
      out.results[ops.stackKey] = rows;
    }
    return out;
  }

  async sync(projectId) {
    if (skipFlag('SKIP_STACK_PROVISION')) {
      return this.current(projectId);
    }
    const axios = require('axios');
    const base = conductorBase();
    const headers = authHeaders(projectId);
    const cur = await this.current(projectId);
    const next = { ...cur.stack };
    for (const ops of listClickOps()) {
      if (!ops.provision) continue;
      const path = (ops.listPath || ops.createPath || `${ops.proxyBase}/${ops.segment}`)
        .replace(/\{projectId\}/g, projectId)
        .replace(/\/apply$/, '');
      const url = `${base}/api/services/${ops.name}${path}`;
      try {
        const res = await axios.get(url, {
          headers,
          params: { project_id: projectId },
          timeout: 15000,
          validateStatus: () => true,
        });
        if (res.status >= 400) continue;
        const data = res.data || {};
        const list = Array.isArray(data.items)
          ? data.items
          : Array.isArray(data[ops.listKey])
            ? data[ops.listKey]
            : [];
        next[ops.stackKey] = list.map((row) => sanitizeResource(ops, row));
      } catch {
        /* keep existing key */
      }
    }
    return this.put(projectId, next);
  }

  async upsertIacModule(projectId, stack) {
    if (skipFlag('SKIP_STACK_IAC') || skipFlag('SKIP_STACK_PROVISION') || process.env.NODE_ENV === 'test') return;
    const axios = require('axios');
    const base = conductorBase();
    const headers = authHeaders(projectId);
    const url = `${base}/api/services/code_as_infra/api/v1/modules`;
    const body = {
      project_id: projectId,
      name: 'project-stack',
      kind: 'json',
      content: JSON.stringify(stack),
    };
    try {
      const listed = await axios.get(url, {
        headers,
        params: { project_id: projectId },
        timeout: 10000,
        validateStatus: () => true,
      });
      const items = listed.data?.items || [];
      const existing = items.find((m) => m.name === 'project-stack');
      if (existing?.id) {
        await axios.patch(`${url}/${existing.id}`, body, {
          headers,
          timeout: 10000,
          validateStatus: () => true,
        });
      } else {
        await axios.post(url, body, {
          headers,
          timeout: 10000,
          validateStatus: () => true,
        });
      }
    } catch (err) {
      console.warn('[stack] IaC mirror failed (enable code_as_infra or hook up IaC):', err.message);
    }
  }

  async revisions(projectId) {
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    return rows.map((r) => ({
      id: r.id,
      revision: Number(r.revision || 0),
      status: r.status,
      created_at: r.created_at,
    }));
  }

  async rollback(projectId) {
    const rows = await ProjectStack.findAll({ where: { project_id: projectId } });
    rows.sort((a, b) => Number(b.revision || 0) - Number(a.revision || 0));
    const latest = rows[0];
    const prev = rows[1];
    if (!latest) {
      const e = new Error('nothing to roll back');
      e.status = 404;
      throw e;
    }
    if (!prev) {
      await ProjectStack.update(latest.id, {
        content: JSON.stringify(emptyStack(projectId)),
        applied: JSON.stringify(emptyStack(projectId)),
        status: 'rolled-back',
      });
      return this.current(projectId);
    }
    await ProjectStack.update(latest.id, {
      content: prev.content,
      applied: prev.content,
      status: 'rolled-back',
    });
    return this.current(projectId);
  }

  async drift(projectId) {
    const d = await this.diff(projectId);
    return { drifted: d.changed, ...d };
  }

  async propose(projectId, prompt) {
    const cur = await this.current(projectId);
    return {
      proposed: cur.stack,
      prompt: prompt || '',
      note: 'infra-copilot propose-only; apply requires iac:Apply',
      auto_apply: false,
    };
  }
}

module.exports = new StackService();
module.exports.StackService = StackService;
module.exports.getClickOps = getClickOps;

'use strict';

const axios = require('axios');
const { Bus, Rule } = require('../models');
const { CrudService, fail } = require('../../../shared/crudBase');

const SKIP_OUTBOUND = process.env.SKIP_OUTBOUND === '1' || process.env.SKIP_OUTBOUND === 'true';

function conductorBase() {
  return (process.env.CONDUCTOR_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
}

function authHeaders() {
  const tok = process.env.CONDUCTOR_TOKEN || process.env.SERVICE_TOKEN || '';
  return tok ? { Authorization: `Bearer ${tok}` } : {};
}

class BusService extends CrudService {
  constructor() { super(Bus); }

  async ensureDefaults(projectId) {
    const existing = await this.list(projectId);
    const byName = new Map(existing.map((b) => [b.name, b]));
    const out = {};
    for (const name of ['default', 'aerekos.fleet']) {
      if (byName.has(name)) {
        out[name] = { item: byName.get(name), created: false };
      } else {
        out[name] = { item: await this.create({ project_id: projectId, name, description: name === 'default' ? 'Default bus' : 'Platform health' }), created: true };
      }
    }
    return out;
  }
}

class EventService {
  constructor() {
    this.buses = new BusService();
  }

  async getBusByName(projectId, name) {
    const rows = await Bus.findAll({ where: { project_id: projectId, name } });
    if (!rows.length) throw fail(404, `bus not found: ${name}`);
    return rows[0];
  }

  async createRule(body) {
    if (!body.project_id) throw fail(400, 'project_id required');
    const name = String(body.name || '').trim();
    if (!name) throw fail(400, 'name required');
    let busId = body.bus_id;
    if (!busId && body.bus) {
      const b = await this.getBusByName(body.project_id, body.bus);
      busId = b.id;
    }
    if (!busId) throw fail(400, 'bus or bus_id required');
    return Rule.create({
      project_id: body.project_id,
      bus_id: busId,
      name,
      source: body.source || '*',
      type_pattern: body.type_pattern || body.type || '*',
      target_kind: body.target_kind || body.target || 'queue',
      target_ref: body.target_ref || body.ref || '',
      enabled: body.enabled === false || body.enabled === 'false' ? 'false' : 'true',
    });
  }

  async listRules(projectId, busId) {
    const where = { project_id: projectId };
    if (busId) where.bus_id = busId;
    return Rule.findAll({ where });
  }

  match(rule, event) {
    if (rule.enabled === 'false') return false;
    const src = rule.source || '*';
    const typ = rule.type_pattern || '*';
    const okSrc = src === '*' || src === event.source;
    const okTyp = typ === '*' || typ === event.type || (event.type && event.type.startsWith(typ.replace('*', '')));
    return okSrc && okTyp;
  }

  async dispatchTarget(projectId, rule, event) {
    const kind = rule.target_kind;
    const ref = rule.target_ref;
    if (['email', 'sms', 'slack'].includes(kind)) {
      return { skipped: true, reason: 'outbound_disabled', kind, ref };
    }
    if (kind === 'push' && SKIP_OUTBOUND) {
      return { skipped: true, reason: 'SKIP_OUTBOUND', kind, ref };
    }
    const base = conductorBase();
    const headers = { ...authHeaders(), 'x-project-id': projectId, 'Content-Type': 'application/json' };
    try {
      if (kind === 'queue') {
        await axios.post(`${base}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(ref)}/messages`, {
          project_id: projectId,
          body: event,
        }, { headers, timeout: 10000, validateStatus: () => true });
        return { kind, ref, ok: true };
      }
      if (kind === 'function') {
        const inbox = ref.endsWith('-inbox') ? ref : `${ref}-inbox`;
        await axios.post(`${base}/api/services/queue_manager/api/v1/queues/${encodeURIComponent(inbox)}/messages`, {
          project_id: projectId,
          body: { source: 'event_manager', event },
        }, { headers, timeout: 10000, validateStatus: () => true });
        return { kind, ref: inbox, ok: true };
      }
      if (kind === 'websocket') {
        await axios.post(`${base}/api/services/websocket_manager/api/v1/publish`, {
          project_id: projectId,
          channel: ref || 'app',
          payload: event,
        }, { headers, timeout: 10000, validateStatus: () => true });
        return { kind, ref, ok: true };
      }
      if (kind === 'webhook' && ref) {
        await axios.post(ref, event, { timeout: 10000, validateStatus: () => true, headers: { 'Content-Type': 'application/json' } });
        return { kind, ref, ok: true };
      }
      if (kind === 'iot') {
        await axios.post(`${base}/api/services/iot_manager/api/v1/publish`, {
          project_id: projectId,
          topic: ref,
          payload: event,
        }, { headers, timeout: 10000, validateStatus: () => true });
        return { kind, ref, ok: true };
      }
      return { kind, ref, skipped: true, reason: 'unhandled' };
    } catch (err) {
      return { kind, ref, ok: false, error: err.message };
    }
  }

  async put(projectId, body) {
    const busName = body.bus || body.bus_name || 'default';
    let bus;
    try {
      bus = await this.getBusByName(projectId, busName);
    } catch (e) {
      if (e.status === 404) {
        bus = await this.buses.create({ project_id: projectId, name: busName });
      } else throw e;
    }
    const event = {
      id: `evt-${Date.now().toString(36)}`,
      bus: bus.name,
      source: body.source || 'sdk',
      type: body.type || 'ping',
      payload: body.payload || body.detail || {},
      project_id: projectId,
      time: new Date().toISOString(),
    };
    const rules = await this.listRules(projectId, bus.id);
    const deliveries = [];
    for (const rule of rules) {
      if (this.match(rule, event)) {
        deliveries.push(await this.dispatchTarget(projectId, rule, event));
      }
    }
    return { event, deliveries };
  }
}

module.exports = { BusService, EventService, SKIP_OUTBOUND };

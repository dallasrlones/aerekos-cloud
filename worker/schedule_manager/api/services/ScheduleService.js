const cron = require('node-cron');
const { Schedule } = require('../models');
const { DispatchService } = require('./DispatchService');

const NAME_RE = /^[a-zA-Z0-9_-]{1,80}$/;

/** @type {Map<string, ReturnType<typeof cron.schedule>>} */
const activeJobs = new Map();

class ScheduleService {
  /**
   * @param {{ Schedule: typeof Schedule, dispatchService?: import('./DispatchService').DispatchService }} [deps]
   */
  constructor(deps = {}) {
    this.Schedule = deps.Schedule || Schedule;
    this.dispatch = deps.dispatchService || new DispatchService();
  }

  assertName(name) {
    if (!name || !NAME_RE.test(String(name).trim())) {
      const e = new Error('Invalid name. Use 1–80 chars: letters, numbers, _, -');
      e.status = 400;
      throw e;
    }
  }

  assertProjectId(projectId) {
    if (!projectId || String(projectId).trim() === '') {
      const e = new Error('project_id is required');
      e.status = 400;
      throw e;
    }
  }

  validateCron(expr) {
    if (!expr || typeof expr !== 'string') {
      const e = new Error('cron_expression is required');
      e.status = 400;
      throw e;
    }
    if (typeof cron.validate === 'function' && !cron.validate(expr.trim())) {
      const e = new Error('Invalid cron expression');
      e.status = 400;
      throw e;
    }
  }

  validateAction(body) {
    const t = body.action_type;
    if (t !== 'webhook' && t !== 'queue') {
      const e = new Error('action_type must be webhook or queue');
      e.status = 400;
      throw e;
    }
    if (t === 'webhook' && !body.target_url) {
      const e = new Error('target_url is required for webhook');
      e.status = 400;
      throw e;
    }
    if (t === 'queue' && !body.target_queue) {
      const e = new Error('target_queue is required for queue');
      e.status = 400;
      throw e;
    }
  }

  registerJob(row) {
    if (process.env.SKIP_CRON === '1' || process.env.SKIP_CRON === 'true') {
      return;
    }
    this.unregisterJob(row.id);
    if (!row.enabled || row.enabled === 0) {
      return;
    }
    const expr = String(row.cron_expression).trim();
    const tz = row.timezone && String(row.timezone).trim() ? String(row.timezone).trim() : 'UTC';

    const task = cron.schedule(
      expr,
      async () => {
        await this._runRow(row.id);
      },
      { scheduled: true, timezone: tz }
    );
    activeJobs.set(row.id, task);
  }

  unregisterJob(id) {
    const t = activeJobs.get(id);
    if (t) {
      t.stop();
      activeJobs.delete(id);
    }
  }

  async _runRow(id) {
    const rows = await this.Schedule.findAll({ where: { id } });
    if (!rows.length) return;
    const row = rows[0];
    if (!row.enabled || row.enabled === 0) return;
    const now = new Date().toISOString();
    try {
      await this.dispatch.dispatch(row);
      await this.Schedule.update(id, { last_run_at: now, last_error: null });
    } catch (e) {
      const msg = e.message || String(e);
      await this.Schedule.update(id, { last_run_at: now, last_error: msg });
      console.error(`[schedule_manager] run failed for ${id}:`, msg);
    }
  }

  /**
   * Run once by id (manual / test)
   */
  async runNow(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.Schedule.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Schedule not found');
      e.status = 404;
      throw e;
    }
    const row = rows[0];
    const now = new Date().toISOString();
    try {
      const result = await this.dispatch.dispatch(row);
      await this.Schedule.update(id, { last_run_at: now, last_error: null });
      return { success: true, result };
    } catch (e) {
      const msg = e.message || String(e);
      await this.Schedule.update(id, { last_run_at: now, last_error: msg });
      const err = new Error(msg);
      err.status = e.status || 500;
      err.data = e.data;
      throw err;
    }
  }

  async create(data) {
    this.assertName(data.name);
    this.assertProjectId(data.project_id);
    this.validateCron(data.cron_expression);
    this.validateAction(data);

    const existing = await this.Schedule.findAll({
      where: { name: data.name, project_id: data.project_id }
    });
    if (existing.length) {
      const e = new Error('Schedule with this name already exists in the project');
      e.status = 409;
      throw e;
    }

    const row = await this.Schedule.create({
      name: String(data.name).trim(),
      project_id: data.project_id,
      cron_expression: String(data.cron_expression).trim(),
      timezone: data.timezone ? String(data.timezone) : 'UTC',
      action_type: data.action_type,
      http_method: (data.http_method || 'POST').toUpperCase(),
      target_url: data.target_url || '',
      target_queue: data.target_queue || '',
      message_template: data.message_template != null ? String(data.message_template) : '',
      request_headers: data.request_headers != null ? String(data.request_headers) : '',
      enabled: data.enabled === false || data.enabled === 0 ? 0 : 1
    });

    this.registerJob(row);
    return row;
  }

  async list(projectId) {
    this.assertProjectId(projectId);
    return this.Schedule.findAll({ where: { project_id: projectId } });
  }

  async getById(id, projectId) {
    this.assertProjectId(projectId);
    const rows = await this.Schedule.findAll({ where: { id, project_id: projectId } });
    if (!rows.length) {
      const e = new Error('Schedule not found');
      e.status = 404;
      throw e;
    }
    return rows[0];
  }

  async update(id, projectId, data) {
    const current = await this.getById(id, projectId);
    const patch = {};
    if (data.cron_expression != null) {
      this.validateCron(data.cron_expression);
      patch.cron_expression = String(data.cron_expression).trim();
    }
    if (data.timezone != null) patch.timezone = String(data.timezone);
    if (data.action_type != null) patch.action_type = data.action_type;
    if (data.http_method != null) patch.http_method = String(data.http_method).toUpperCase();
    if (data.target_url != null) patch.target_url = data.target_url;
    if (data.target_queue != null) patch.target_queue = data.target_queue;
    if (data.message_template != null) patch.message_template = String(data.message_template);
    if (data.request_headers != null) patch.request_headers = String(data.request_headers);
    if (data.enabled != null) patch.enabled = data.enabled ? 1 : 0;

    if (Object.keys(patch).length) {
      this.validateAction({
        action_type: patch.action_type != null ? patch.action_type : current.action_type,
        target_url: patch.target_url != null ? patch.target_url : current.target_url,
        target_queue: patch.target_queue != null ? patch.target_queue : current.target_queue
      });
      await this.Schedule.update(id, patch);
    }

    const row = await this.getById(id, projectId);
    this.registerJob(row);
    return row;
  }

  async delete(id, projectId) {
    await this.getById(id, projectId);
    this.unregisterJob(id);
    await this.Schedule.delete(id);
    return { deleted: true, id };
  }

  /**
   * Load all enabled schedules and register cron (call after process up)
   */
  async startAll() {
    const rows = await this.Schedule.findAll({ where: { enabled: 1 } });
    for (const r of rows) {
      this.registerJob(r);
    }
    console.log(`[schedule_manager] registered ${activeJobs.size} active cron job(s)`);
  }

  static stopAll() {
    for (const [id, task] of activeJobs) {
      task.stop();
    }
    activeJobs.clear();
  }
}

module.exports = { ScheduleService, activeJobs };

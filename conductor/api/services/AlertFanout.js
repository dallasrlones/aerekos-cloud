'use strict';

/**
 * Best-effort alert to notify managers. Queue-only when keys are missing.
 */
const ServiceManager = require('./ServiceManager');
const WorkerRepository = require('../repos/WorkerRepository');

async function notify(projectId, { title, body, severity }) {
  const pid = projectId || process.env.DEFAULT_PROJECT_ID;
  if (!pid) return { skipped: true, reason: 'no_project' };
  const sm = ServiceManager.getInstance(WorkerRepository);
  const text = `[${severity || 'warn'}] ${title || 'alert'}: ${body || ''}`;
  const results = [];
  for (const [svc, path, payload] of [
    ['slack_manager', '/api/v1/messages', { project_id: pid, text, body: text }],
    ['email_manager', '/api/v1/messages', { project_id: pid, subject: title, body: text, to: process.env.ALERT_EMAIL_TO }],
    ['sms_manager', '/api/v1/messages', { project_id: pid, body: text, to: process.env.ALERT_SMS_TO }],
    ['push_manager', '/api/v1/send', { project_id: pid, title: title || 'alert', body: text, to: process.env.ALERT_PUSH_TO }],
  ]) {
    try {
      const created = await sm.proxyServiceRequest(svc, 'POST', path, payload, {}, pid);
      const id = created?.data?.item?.id || created?.item?.id;
      if (id) {
        await sm.proxyServiceRequest(svc, 'POST', `${path}/${id}/send`, { project_id: pid }, {}, pid);
      }
      results.push({ svc, ok: true });
    } catch (e) {
      results.push({ svc, ok: false, error: e.message });
    }
  }
  return { results };
}

module.exports = { notify };
